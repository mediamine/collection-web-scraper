# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NestJS **standalone application** (no HTTP server) that scrapes New Zealand news publications and writes articles into a shared PostgreSQL database (the MediaMine `news_item` table). It is invoked via `NestFactory.createApplicationContext` in [src/main.ts](src/main.ts), runs one scraping session, and exits. There are no controllers — `AppModule` exists only to wire up services for a single `AppService.scrape()` call.

In production it runs as a Docker container per workflow (see [docker-compose.yml](docker-compose.yml)) with `restart: always`; [entrypoint.sh](entrypoint.sh) sleeps 2 hours between runs, so scheduling is a sleep-loop, not cron.

## Commands

```bash
yarn                       # install
yarn prisma:generate       # REQUIRED before build/start — generates Prisma client from prisma/schema.prisma
yarn build                 # nest build, after the prebuild hook runs `yarn test:ci` — red tests or coverage below threshold stop the build
yarn start                 # run one scrape session (reads WORKFLOW env var)
yarn start:dev             # watch mode
yarn lint                  # eslint --fix over {src,apps,libs,test,scripts} — code-quality rules only
yarn format                # prettier --write over src/, test/ and scripts/
yarn format:check          # prettier --check (verify formatting, e.g. in CI) — writes nothing

# Jest unit tests (*.spec.ts under src/ and scripts/)
yarn test                  # all unit tests
yarn test -- the-post      # single file/pattern by name
yarn test:watch
yarn test:cov
yarn test:ci               # --ci --coverage, enforcing the coverage thresholds — what the build gates run
yarn test:report           # test:ci once, then post the result to Teams (see "Unit tests" below)

# Playwright E2E tests (separate suite under test/, hits live news sites)
yarn test:playwright       # delegates to `yarn --cwd test playwright test`
```

Formatting and linting are deliberately separate concerns: **Prettier** owns formatting (`format` / `format:check`) and **ESLint** does code quality only. [.eslintrc.js](.eslintrc.js) extends `eslint-config-prettier` (not `plugin:prettier/recommended`), so ESLint does *not* run Prettier as a rule — don't re-add `eslint-plugin-prettier`. The [modules/collection-web-scraper-test/](modules/collection-web-scraper-test/) workspace follows the same split but is on **ESLint 9**, so it uses flat config ([eslint.config.mjs](modules/collection-web-scraper-test/eslint.config.mjs) with `typescript-eslint`, non-type-checked so no tsconfig is required) rather than `.eslintrc.js`. The two ESLint setups are on different majors and are not interchangeable.

## How a scrape runs

`AppService.scrape()` ([src/app.service.ts](src/app.service.ts)) branches on the `WORKFLOW` env var into one of three workflows. For each, it parses a `FEEDS_TO_IDS_*` env var — a JSON object mapping a **scraper token** to an array of `feed` table IDs — inverts it to `feedId -> scraperToken`, loads each `feed` row from the DB, and calls the workflow's `scan({ feed, feedScraper })`.

The four workflows (in [src/workflow/](src/workflow/)):

- **WORKFLOW_COMPLETE_SCAN** — opens Playwright, scrapes section home pages for article links, inserts new `news_item` rows, then visits each article page to fill `page_text`.
- **WORKFLOW_PAGE_TEXT_SCAN** — does *not* discover links; only fills `page_text` for existing `news_item` rows that have none (used for sites where links arrive by other means).
- **WORKFLOW_PAGE_TEXT_SCAN_V2** — as above, plus it re-scrapes rows whose `page_text` is shorter than `PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT`, which recovers articles saved with only a paywall teaser. It also realigns `news_item.date_downloaded` to `date` whenever the article's own date is the later of the two, so the one-month candidate window is measured from the article rather than from a stale download stamp. That realignment is its own write, made before the article is scraped, so it still happens when the scrape yields nothing or throws on an article the session is not entitled to. Deliberately isolated from `WORKFLOW_PAGE_TEXT_SCAN` — separate module, scrapers, config and container — so it currently serves only Otago Daily Times and cannot affect the v1 feeds.
- **WORKFLOW_RSS_SCAN** — discovers items via RSS (no browser); uses the item's RSS `description` as `page_text`.

Both page-text workflows call their link guard **un-negated** (`if (link && isPageTextScan…(link))`), like
complete-scan does — the helper returns "this link is allowed". v1 previously negated it, which inverted
the meaning so that the only thing it scraped was `businessdesk.co.nz/journalist/` author pages; that was
fixed, which also re-activated page-text scraping for the Stuff and NBR feeds after a long dormancy.
Their scrapers had drifted while dormant and were refreshed against the live sites — all three
page-text publications are covered by [page-text-scan.group-a.spec.ts](modules/collection-web-scraper-test/tests/page-text-scan.group-a.spec.ts),
which is the source of truth for their selectors.

The RSS workflow (Beehive, Newstalk ZB) fetches feeds through `RssParserService`
([rss-parser.service.ts](src/browser/rss-parser/rss-parser.service.ts)), which sends a **browser User-Agent**
on purpose. Beehive sits behind Imperva Incapsula, which answers `rss-parser`'s default `User-Agent: rss-parser`
with an HTML bot challenge, so a `sax` error such as `Attribute without value … Char: >` means a site returned
HTML instead of XML, not that the feed is malformed. An item with an empty `<description>` (ZB does ship these)
is inserted but given no `page_text`. Both feeds are covered by
[rss-scan.group-a.spec.ts](modules/collection-web-scraper-test/tests/rss-scan.group-a.spec.ts), one test per
Newstalk ZB section feed.

### The scraper-token DI pattern (central to the architecture)

Scraper classes are **not** referenced directly by the workflow. Instead:

1. String constants in [src/constant/feedScrapers.ts](src/constant/feedScrapers.ts) (e.g. `NEWS_ITEM_SOURCE_THE_POST = 'The Post'`) act as NestJS DI tokens.
2. Each workflow module (e.g. [complete-scan.module.ts](src/workflow/complete-scan/complete-scan.module.ts)) registers providers as `{ provide: <TOKEN>, useClass: <Service> }` **and** re-exports the token.
3. At runtime the workflow resolves the right scraper with `this.moduleRef.get<ScannerProps>(feedScraper, { strict: false })`, where `feedScraper` is the token string that came from the `FEEDS_TO_IDS_*` config.

So the mapping "this feed → that scraper class" lives in environment config, not code.

### Publication scrapers

All scrapers implement the `ScannerProps` interface from [src/publication/types.ts](src/publication/types.ts): `authenticate`, `scanHome`, `scanArticle`, `logout`.

Complete-scan scrapers live under [src/publication/complete-scan/](src/publication/complete-scan/) grouped `group-a` … `group-f`. **The group, not the publication, owns the scraping logic**: each `group-X.service.ts` is a base class implementing the shared login flow and DOM selectors for a family of sites, and each per-publication subclass typically only overrides the list of sections to scan (see [group-a.service.ts](src/publication/complete-scan/group-a/group-a.service.ts) vs [the-post.service.ts](src/publication/complete-scan/group-a/the-post/the-post.service.ts)). The numbered/`Subscription` variants (`The Post 2`, `… (Subscription)`) are distinct DB feeds reusing the same logic via different group base classes. Page-text and RSS scrapers each implement `ScannerProps` directly.

Group b (stuff.co.nz regional pages) and group f (the regional pages under thepost.co.nz / thepress.co.nz) read the same card markup as group e: `[data-testid="grid-card-content"] > a` with an `h3` headline, and article text from `div[data-testid="body-paragraph"] > p`. **Group c is dead**: it targets the same eight URLs as group f but the retired `ion-card` markup, which no longer exists, and its Playwright spec has been `test.skip` since group f replaced it. Any feed still mapped to an un-numbered `… (Subscription)` token (group c) rather than `… (Subscription) 2` (group f) scrapes nothing. In complete-scan, a `scanArticle` that comes back empty is logged as a warning and not written, so the row stays blank and is retried on the next run. An empty scrape usually means the article selectors have drifted, with one known exception: stuff.co.nz video-led articles (~6% in group b) have no body paragraphs, only a one-line `video-intro` blurb, so they always scrape empty. That is also why the group-b Playwright spec tries up to 3 articles before failing. Group b uses the card headline as the `description` too, since stuff.co.nz cards carry no standfirst.

## Adding a new scraper

1. Add a token constant in [feedScrapers.ts](src/constant/feedScrapers.ts).
2. Create the service (usually extend the relevant `group-X.service.ts`, or implement `ScannerProps` for page-text/RSS).
3. Export it from the matching `src/publication/<workflow>/index.ts` barrel.
4. Register it in the workflow module's `providers` **and** `exports` as `{ provide: TOKEN, useClass: Service }`.
5. Add a `*.spec.ts` beside it: `describeSectionScraper` for a subclass that only lists sections, `describeEmptySubclass` for one that adds nothing, otherwise a full spec against `createMockPage` (see "Unit tests"). Add the token to the workflow's `*.module.spec.ts` table too.
6. Map a feed ID to the token in the relevant `FEEDS_TO_IDS_*` env var.

## Unit tests

Jest runs every `*.spec.ts` under `src/` and `scripts/` with `rootDir` at the repo root; `moduleNameMapper` maps the `'src/...'` imports the code uses everywhere (they resolve through `tsconfig` `baseUrl` at compile time, which Jest's runtime resolver ignores). Coverage thresholds live in `package.json` `jest.coverageThreshold` and are enforced by `test:ci`, which gates both `yarn build` (`prebuild`) and the Docker image (a `RUN yarn test:ci` step, since the container runs `yarn start` rather than `yarn build`).

Specs mock everything external, so they need no database, browser, network or env, only the generated Prisma client. Shared helpers in [src/testing/](src/testing/) (excluded from the build and from coverage):

- `createServiceModule` / `createWorkflowModule` compile the class under test through real Nest DI with mocked `ConfigService`, `WinstonLoggerService` (the real one writes to `./logs`), `PrismaService` and `PlaywrightService`; `createWorkflowModule` registers a mock scraper under `SCRAPER_TOKEN` for the workflow's `ModuleRef` lookup. `pinClock` fixes luxon's clock for the one-month window.
- `createMockPage({ [key]: spec })` stands in for a Playwright `Page`. Locators are cached by how they were looked up — a CSS selector as-is, or `role()`, `label()`, `testId()`, `inFrame()`, `hasText()` keys — so a spec configures `count`, `innerText`, `allTextContents`, child locators or rejections up front and asserts on `page.locatorFor(key)` afterwards.
- `compileWorkflowModule` compiles a real workflow module; the `*.module.spec.ts` files use it to prove every `FEEDS_TO_IDS_*` token resolves to its scraper.

**Known defects are pinned as `it.failing`**, asserting the *correct* behaviour so the suite stays green; fixing one turns its test red, and the fix is then to change `it.failing` to `it`. Currently: `PlaywrightService.closeBrowser` throws when no browser was opened (every workflow calls it in `finally`); `AppService` skips every remaining feed after a feed id with no row; page-text-scan v1 opens the browser on `candidates[0].link` only and swallows errors in an empty `catch`; section scrapers' `scanHome` discards every section when one fails and logs via `console.error`; a negative `PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT` disables v2's short-text pass without its warning.

The daily Teams report is [scripts/unit-test-report/run.ts](scripts/unit-test-report/run.ts) (`yarn test:report`), scheduled on a host by [start-unit-test-report.sh](start-unit-test-report.sh) `[HH:MM] [--pull]` (default 07:00 host time). It wraps a Jest run rather than being a Jest reporter, because Jest runs custom reporters before its coverage reporter. It posts the same Power Automate Adaptive Card envelope as the Playwright workspaces' reporter, with counts, coverage against the thresholds, the first ten failures and, unless green, @mentions; it always exits with Jest's code.

## Database (Prisma)

[prisma/schema.prisma](prisma/schema.prisma) is the full introspected MediaMine schema (many tables); scrapers touch mainly `feed` (read + `last_download_date` update) and `news_item` (read/insert/update). Notes that bite:

- Connection is `DATABASE_URL`; the DB is shared/legacy and managed elsewhere — **do not run migrations from here**, only `prisma generate`.
- `news_item.id` is `BigInt` and is assigned manually as `max(id) + index + 1` (no autoincrement). [src/main.ts](src/main.ts) patches `BigInt.prototype.toJSON` so logs/serialization don't throw.
- Deduplication is by `hashcode` = `hashIt(feedId + title + link + description)`, with a unique index on `news_item.hashcode`.
- "Needs page text" is modeled as `page_text === '' || page_text === null`, queried in two passes and concatenated. Page-text-scan-v2 adds a third pass for short-but-non-empty text; since Prisma's query API has no string-length filter, that one is a `$queryRaw` returning ids only, which are then re-hydrated through `findMany` so all passes yield full `news_item` rows.

## Configuration

Env is loaded by `ConfigModule` from `.env`, `.env.dev`, `.env.prod` (first found wins per key). Key variables:

- `WORKFLOW` — `WORKFLOW_COMPLETE_SCAN` | `WORKFLOW_PAGE_TEXT_SCAN` | `WORKFLOW_PAGE_TEXT_SCAN_V2` | `WORKFLOW_RSS_SCAN` (selects the branch in `AppService`).
- `FEEDS_TO_IDS_COMPLETE_SCAN` / `_PAGE_TEXT_SCAN` / `_PAGE_TEXT_SCAN_V2` / `_RSS_SCAN` — JSON `{ "<scraper token>": ["<feedId>", …] }`. A feed id must appear in only one of these, or two containers will scrape it concurrently.
- `PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT` — re-scrape threshold in characters for page-text-scan-v2 only; unset or `0` disables it and the workflow logs a warning. For ODT, full articles run ~2300-4400 chars and teaser/RSS descriptions ~100-160, so the threshold belongs in the gap.
- `DATABASE_URL` — Postgres connection.
- `STUFF_LOGIN_USERNAME` / `STUFF_LOGIN_PASSWORD` — credentials for Stuff-network logins (group-a `authenticate`).
- `BD_LOGIN_USERNAME` / `BD_LOGIN_PASSWORD` — **no longer used.** `BusinessDeskService` is scraped anonymously: `authenticate`/`logout` are no-ops. A paywalled BD article renders no `div.article-body` at all, only a ~515-540 char teaser as raw text inside `div.paywall` (no `<p>` children), while a free article renders the full `div.article-body` (~11k chars). `scanArticle` handles both and throws when neither is present, since returning `''` would blank an existing `page_text` — v1 has no "don't overwrite" guard, that is v2-only.
- `NBR_LOGIN_USERNAME` / `NBR_LOGIN_PASSWORD` — National Business Review subscriber credentials. `authenticate` navigates straight to `nbr.co.nz/Security/login/?BackURL=%2F` rather than hunting a header link (the workflow opens a `news_item` link, not the home page), fills `input[name="Email"]` / `input[name="Password"]`, and submits `input[type="submit"][name="action_doLogin"]` — the control is an `<input>`, not a `<button>`. Success is the header's **My Account** link; `.toggle-menu` is present signed in or out, so it is not a usable signal. Signed out an NBR article yields only a ~290 char teaser versus thousands signed in, so a short `page_text` means the session was lost. The account is single-session: two concurrent NBR logins log each other out.
- `ODT_LOGIN_USERNAME` / `ODT_LOGIN_PASSWORD` — Otago Daily Times subscriber credentials, used against the Piano ID login (`id-au.piano.io`) in `OtagoDailyTimesService.authenticate`. That method has **two** entry points, because the workflow opens a `news_item` link directly rather than the home page: on a premium article Piano pops a subscription offer dialog (iframe `id^="offer-"`) whose "Already a subscriber? Sign in" (`a.sign-in-bold`) opens the login form, and everywhere else the header control (`div.sign-in-button button`) does. The login form always lands in a separate iframe `id^="piano-id"` — do not target it via `.tp-modal iframe` (matches the offer dialog too) or via `src`, since both iframes carry the id host in their query string.
- `HEADLESS` — `'true'`/`'false'` for Playwright.
- `UNIT_TESTS_WEBHOOK_URL` / `UNIT_TESTS_MENTION_ON_FAILURE` / `UNIT_TESTS_REPORT_ENV` — the daily unit test report only, read by `yarn test:report` from the same three env files in the same order (documented in [.env.example](.env.example)). Separate from the Playwright workspaces' `TESTS_WEBHOOK_URL` so the two can post to different channels. Without the URL the report is only printed.

## Conventions

- Logging goes through `WinstonLoggerService` (transient-scoped, daily-rotated files under `./logs/` plus console); call `this.logger.setContext(X.name)` in each service constructor.
- `tsconfig.json` has `strictNullChecks: false` and `noImplicitAny: false` — the code leans on this; `feed`/`news_item` fields are frequently nullable in the schema but used as if present.
- Workflow `scan` methods are intentionally fault-tolerant: per-item failures are caught and logged so one bad article/feed doesn't abort the session; the browser is always closed in `finally`.
- Live verification runs from **standalone Playwright workspaces** that scrape real sites and report to MS Teams when `TESTS_WEBHOOK_URL` is set — they duplicate scraper logic rather than importing `src/`. Two exist, each with its own `package.json`/`node_modules`/lockfile (so a dependency change needs a `yarn install` in that folder): [test/](test/), invoked from the repo root via `yarn test:playwright`, and the newer [modules/collection-web-scraper-test/](modules/collection-web-scraper-test/) (Playwright 1.62, ESLint 9 flat config, more spec files, `rss-parser` for the RSS spec) which is run on its own.
