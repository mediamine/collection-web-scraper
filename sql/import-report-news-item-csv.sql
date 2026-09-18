-- ============================================================================
--  import-report-news-item-csv.sql
--
--  Loads hand-curated article rows from a CSV export into `report_news_item`
--  (plus the backing `news_item` row each one requires).
--
--    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--         -v report_id=1234 -v report_profile_id=567 \
--         -f sql/import-report-news-item-csv.sql \
--         < '.sample/MBNZ Streem Articles Database(in).csv'
--
--  The CSV arrives on psql's stdin (hence PSTDIN below) rather than as a path:
--  \copy takes its argument as a whole line, so a :'csv_path' variable would
--  never be interpolated. Read with \copy, not server-side COPY, so the file is
--  read from wherever psql runs and quoting / embedded commas / embedded
--  newlines follow the RFC-4180 rules Postgres already implements — nothing is
--  hand-escaped here. Header row required, columns in the order below.
--
--  Streem exports are Windows-1252 (curly quotes, "Coupé"), which is the
--  default; pass -v csv_utf8=1 for a UTF-8 export. Getting this wrong either
--  errors ("invalid byte sequence") or stores mojibake — it is not cosmetic.
--
--  CSV -> column mapping
--  ---------------------------------------------------------------------------
--    Article Title   -> title                (and news_item.title)
--    Date Published  -> pub_date             (DD/MM/YYYY, read as NZ local time)
--    Publication     -> source + publication_id (resolved by name) + feed_fk
--    Author          -> description          -- see NOTE 1
--    Formula 1?      -> category / original_category   -- see NOTE 2
--    Keywords        -> matchedcriteria      (comma-separated, stored verbatim)
--    Added           -> not a column; it is the CSV's own load flag. Rows are
--                       imported only WHERE added = FALSE, so re-running after
--                       flipping the flag to TRUE in the CSV is a no-op.
--
--  NOTE 1: `report_news_item` has no author column. `description` is the only
--          free-text field rendered in reports, so the byline goes there. Swap
--          to `pageextract` if description must stay empty for the report layout.
--  NOTE 2: "Formula 1?" is a yes/no classifier, `category` is free text.
--          Yes -> 'Formula 1', No -> 'Non-Formula 1'. Change the two CASE
--          expressions below if the report profile uses different category names.
--          `original_category` mirrors `category` on import (it records what the
--          categoriser assigned before any manual recategorisation).
--
--  Columns with no CSV source: link, pageextract, analysis_completed -> NULL;
--  in_report 'Y', duplicate/syndicated 'N', high_prominence 'N', relevant and
--  in_analysis true, version 0, page_text_character_count 0 (the CSV carries no
--  article body). Adjust the literals in the final SELECT to taste.
--
--  ids: neither table autoincrements — both are assigned max(id) + n, the same
--  convention CompleteScanService/RssScanService use. The EXCLUSIVE locks make
--  that safe against a scrape running concurrently.
--
--  Requires psql >= 12 (\warn, \if :{?var}, MATERIALIZED CTEs).
-- ============================================================================

\if :{?report_id}
\else
  \warn 'ABORT: pass a report id, e.g. -v report_id=1234'
  \quit
\endif

\if :{?report_profile_id}
\else
  \warn 'ABORT: pass a report profile id, e.g. -v report_profile_id=567'
  \quit
\endif

-- Streem exports are Windows-1252; \copy transcodes to the database encoding.
-- The two branches differ only in the ENCODING literal, which cannot be a
-- variable for the whole-line reason above.
\if :{?csv_utf8}
\else
  \set csv_utf8 0
\endif

-- --------------------------------------------------------------------------
-- Pre-flight: both FK parents must exist and must agree with each other.
-- (Done client-side, not in a DO block: psql does not interpolate :vars inside
-- dollar-quoted strings.)
-- --------------------------------------------------------------------------
SELECT EXISTS (SELECT 1 FROM report         WHERE id = :report_id)         AS report_exists,
       EXISTS (SELECT 1 FROM report_profile WHERE id = :report_profile_id) AS profile_exists,
       EXISTS (SELECT 1 FROM report
               WHERE id = :report_id
                 AND report_profile_id = :report_profile_id)               AS report_matches_profile
\gset

\if :report_exists
\else
  \warn 'ABORT: no report row with that id.'
  \quit
\endif

\if :profile_exists
\else
  \warn 'ABORT: no report_profile row with that id.'
  \quit
\endif

\if :report_matches_profile
\else
  \warn 'ABORT: that report does not belong to that report_profile.'
  \quit
\endif

BEGIN;

-- Date Published has no time or zone; the publications are NZ, so pin the
-- session zone rather than inheriting the server's.
SET LOCAL TimeZone = 'Pacific/Auckland';

-- Landing table for the raw CSV: every column text (except the Added flag) so a
-- malformed date or stray value fails in the transform below, where it can be
-- reported, rather than inside \copy. line_no preserves CSV order, which is what
-- the generated ids follow.
CREATE TEMP TABLE csv (
  line_no        bigserial PRIMARY KEY,
  article_title  text,
  date_published text,
  publication    text,
  author         text,
  formula_1      text,
  keywords       text,
  added          boolean
) ON COMMIT DROP;

\if :csv_utf8
\copy csv (article_title, date_published, publication, author, formula_1, keywords, added) FROM PSTDIN WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\else
\copy csv (article_title, date_published, publication, author, formula_1, keywords, added) FROM PSTDIN WITH (FORMAT csv, HEADER true, ENCODING 'WIN1252')
\endif

-- Serialise id assignment against concurrent inserts (scrapers do max(id) + 1
-- too). EXCLUSIVE still allows readers.
LOCK TABLE news_item, report_news_item IN EXCLUSIVE MODE;

WITH
base AS MATERIALIZED (
  SELECT coalesce((SELECT max(id) FROM news_item), 0)        AS news_item_base,
         coalesce((SELECT max(id) FROM report_news_item), 0) AS report_news_item_base
),
src AS MATERIALIZED (
  SELECT
    b.news_item_base        + row_number() OVER (ORDER BY c.line_no) AS news_item_id,
    b.report_news_item_base + row_number() OVER (ORDER BY c.line_no) AS report_news_item_id,
    c.article_title                                        AS title,
    c.author                                               AS description,
    c.publication                                          AS source,
    to_timestamp(c.date_published, 'DD/MM/YYYY')           AS pub_date,
    nullif(c.keywords, '')                                 AS matchedcriteria,
    CASE WHEN upper(c.formula_1) IN ('YES', 'Y', 'TRUE')
         THEN 'Formula 1' ELSE 'Non-Formula 1' END         AS category,
    p.id                                                   AS publication_id,
    f.id                                                   AS feed_fk
  FROM csv c
  CROSS JOIN base b
  -- Publication name is the only join key the CSV offers; unmatched names leave
  -- publication_id/feed_fk NULL (both are nullable) rather than failing the load.
  LEFT JOIN publication p
         ON lower(p.name) = lower(trim(c.publication))
  -- Best-effort: a publication can own several feeds and the CSV does not say
  -- which. Lowest id wins, deterministically. Drop this join to leave feed_fk NULL.
  LEFT JOIN LATERAL (
    SELECT id FROM feed WHERE publication_id = p.id ORDER BY id LIMIT 1
  ) f ON TRUE
  -- IS NOT TRUE, not "= FALSE": an empty Added cell arrives as NULL and must
  -- still be treated as not-yet-imported.
  WHERE c.added IS NOT TRUE
),
-- report_news_item.news_item_id is NOT NULL and the CSV has no such id, so the
-- backing article row is created here. link/hashcode stay NULL (no URL to hash,
-- and hashIt() from the scrapers is not reproducible in SQL) and page_text is
-- non-empty so WORKFLOW_PAGE_TEXT_SCAN never tries to re-fetch these.
-- If the news_item rows already exist, delete this CTE and resolve
-- src.news_item_id with a lookup on title/link instead.
ins_news_item AS (
  INSERT INTO news_item (
    id, link, title, description, source, date, date_downloaded, feed_fk, hashcode, page_text
  )
  SELECT s.news_item_id, NULL, s.title, s.description, s.source,
         s.pub_date, now(), s.feed_fk, NULL, '[csv import]'
  FROM src s
  RETURNING id
)
INSERT INTO report_news_item (
  id,
  news_item_id,
  report_id,
  report_profile_id,
  link,
  title,
  description,
  source,
  in_report,
  report_date,
  category,
  original_category,
  pub_date,
  version,
  pageextract,
  matchedcriteria,
  duplicate,
  syndicated,
  relevant,
  in_analysis,
  high_prominence,
  page_text_character_count,
  publication_id,
  feed_fk,
  analysis_completed
)
SELECT
  s.report_news_item_id,
  s.news_item_id,
  :report_id,
  :report_profile_id,
  NULL,                 -- link: not present in the CSV
  s.title,
  s.description,        -- author, see NOTE 1
  s.source,
  'Y',                  -- in_report
  now(),                -- report_date: when the row entered the report
  s.category,
  s.category,           -- original_category mirrors category on import
  s.pub_date,
  0,                    -- version
  NULL,                 -- pageextract: no article body in the CSV
  s.matchedcriteria,
  'N',                  -- duplicate
  'N',                  -- syndicated
  TRUE,                 -- relevant
  TRUE,                 -- in_analysis
  'N',                  -- high_prominence
  0,                    -- page_text_character_count
  s.publication_id,
  s.feed_fk,
  NULL                  -- analysis_completed
FROM src s;

-- Read back a summary before COMMIT (scoped to the whole report, so pre-existing
-- rows are included in the counts).
SELECT count(*)                                          AS rows_in_report,
       count(*) FILTER (WHERE category = 'Formula 1')     AS formula_1,
       count(*) FILTER (WHERE publication_id IS NULL)     AS unresolved_publication,
       min(pub_date)::date                                AS earliest_pub_date,
       max(pub_date)::date                                AS latest_pub_date
FROM report_news_item
WHERE report_id = :report_id;

-- Publications the CSV named that have no `publication` row. Not fatal — those
-- rows load with publication_id/feed_fk NULL — but each one is a report item
-- that will not roll up under its masthead.
SELECT DISTINCT source AS unmatched_publication
FROM report_news_item
WHERE report_id = :report_id
  AND publication_id IS NULL
ORDER BY 1;

COMMIT;
