# collection-web-scraper-test

Lightweight Playwright end-to-end tests for MediaMine broadcast news items collection. Designed for local development and CI runs.

## Key points

- Test runner: Playwright Test configured in [playwright.config.ts](playwright.config.ts)
- Test files: [tests/edit-suite.spec.ts](tests/edit-suite.spec.ts), [tests/journalist-directory.spec.ts](tests/journalist-directory.spec.ts), [tests/newsroom.spec.ts](tests/newsroom.spec.ts)
- CI: GitHub Actions workflow at [.github/workflows/playwright.yml](.github/workflows/playwright.yml)
- Report output: `playwright-report/` (generated HTML) — example: [playwright-report/index.html](playwright-report/index.html)
- Re-run loop helper: [start.sh](start.sh)

## Prerequisites

- Node.js (LTS recommended)
- Yarn (project scripts assume yarn)
- Playwright browsers installed (see installation step)

## Setup (local)

1. Install dependencies:

```sh
yarn
yarn playwright install chromium
```

2. Provide environment variables required by tests:

- MEDIAMINE_LOGIN_USERNAME
- MEDIAMINE_LOGIN_PASSWORD
  These are referenced in:
- tests/edit-suite.spec.ts
- tests/journalist-directory.spec.ts
- tests/newsroom.spec.ts
  You can add them to a .env file (not committed) or set them in your shell environment.

Run tests
Single run:

```sh
yarn test
```

Continuous loop (runs tests every hour):

```sh
./start.sh
```

Formatting & linting:

```sh
yarn format
```

Lint and auto-fix:

```sh
yarn lint
```

Configuration files:

- ESLint: .eslintrc.js
- Prettier: .prettierrc
- Package metadata: package.json
  CI and reporting
- The workflow .github/workflows/playwright.yml installs dependencies, browsers, runs tests and uploads playwright-report/ as an artifact. Playwright reporter configuration is in playwright.config.ts.

License
MIT
