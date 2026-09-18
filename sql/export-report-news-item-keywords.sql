-- ============================================================================
--  export-report-news-item-keywords.sql
--
--  Exports the `report_news_item` rows generated in a trailing window (default
--  6 months) as CSV on stdout, for offline keyword co-occurrence analysis.
--
--    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--         -f sql/export-report-news-item-keywords.sql > articles.csv
--
--    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v shape=keywords \
--         -f sql/export-report-news-item-keywords.sql > article-keywords.csv
--
--  Read-only. Runs in one transaction so the window is a consistent snapshot,
--  and creates only ON COMMIT DROP temp tables. Progress/summary lines go to
--  stderr via \warn, so stdout is nothing but CSV and is safe to redirect.
--
--  Variables, all optional
--  ---------------------------------------------------------------------------
--    shape=articles|keywords  articles (default): one row per report_news_item,
--                             every column, verbatim -- the faithful export.
--                             keywords: one row per (article, keyword), already
--                             split and normalised -- the analysis-ready shape.
--    months=6                 trailing window size.
--    date_column=report_date  which date the window applies to. report_date is
--                             when the item was generated into a report (the
--                             `rep_date_idx` index); pub_date is when the
--                             article was published; analysis_completed is when
--                             an analyst finished it. These differ a lot for
--                             back-loaded items -- a CSV import stamps
--                             report_date with the import time, not the news
--                             date, so pick pub_date to window by news date.
--    report_profile_id=0      0 (default) exports every profile.
--
--  Keyword handling (shape=keywords)
--  ---------------------------------------------------------------------------
--  `matchedcriteria` is a comma-separated list ("Mercedes-AMG, GT, AMG's").
--  Each row is split on the comma and trimmed, and two forms are emitted:
--
--    keyword       the term as it appears, trimmed. Nothing else done to it.
--    keyword_norm  lowercased, possessives dropped, every run of non-alphanumeric
--                  characters folded to a single space. This is what collapses
--                  "Mercedes-Benz", "Mercedes Benz" and the possessive form onto
--                  one term -- without it they are three uncorrelated keywords
--                  and the co-occurrence matrix is mostly noise.
--
--  Normalising is lossy and deliberately conservative: it does NOT stem, split
--  compounds, or merge "Mercedes" with "Mercedes-Benz" -- those are genuinely
--  different terms in this data. Possessive stripping requires the apostrophe,
--  so "S Class" survives intact and a bare trailing "s" is never removed.
--  Correlate on keyword_norm, and keep `keyword` to report in.
--
--  Pairs are deduplicated per (article, keyword_norm), so an article naming
--  both "Mercedes-Benz" and "Mercedes Benz" contributes that term once rather
--  than inflating its own co-occurrence counts.
--
--  Rows with no keywords are dropped from the keywords shape (they cannot
--  co-occur with anything); the count is reported on stderr so the drop is
--  never silent. They are still present in the articles shape.
--
--  Nothing is filtered on in_report / relevant / duplicate / syndicated -- all
--  four ship as columns so the filtering is yours. For co-occurrence you almost
--  certainly want `duplicate <> 'Y'`, or one syndicated story republished
--  across a dozen mastheads will dominate every pair it takes part in.
--
--  Requires psql >= 12.
-- ============================================================================

-- Command tags ("BEGIN", "SELECT 157") would otherwise land on stdout and
-- corrupt the CSV, so quiet mode is forced here rather than left to a -q flag
-- the caller has to remember. The \warn summary below still reaches stderr.
\set QUIET on

\if :{?shape}
\else
  \set shape articles
\endif

\if :{?months}
\else
  \set months 6
\endif

\if :{?date_column}
\else
  \set date_column report_date
\endif

\if :{?report_profile_id}
\else
  \set report_profile_id 0
\endif

-- --------------------------------------------------------------------------
-- Validate the variables that land in the query as identifiers rather than as
-- values, so a typo fails here with a readable message instead of as a syntax
-- error further down.
-- --------------------------------------------------------------------------
SELECT (:'shape' IN ('articles', 'keywords'))                                AS shape_ok,
       (:'shape' = 'keywords')                                               AS want_keywords,
       (:'date_column' IN ('report_date', 'pub_date', 'analysis_completed'))  AS date_column_ok,
       (:months > 0)                                                         AS months_ok
\gset

\if :shape_ok
\else
  \warn 'ABORT: shape must be articles or keywords.'
  \quit
\endif

\if :date_column_ok
\else
  \warn 'ABORT: date_column must be report_date, pub_date or analysis_completed.'
  \quit
\endif

\if :months_ok
\else
  \warn 'ABORT: months must be a positive integer.'
  \quit
\endif

BEGIN;

-- Dates render as NZ calendar dates, matching how the articles were published
-- and how the import script read them.
SET LOCAL TimeZone = 'Pacific/Auckland';

-- --------------------------------------------------------------------------
-- The window. Scoped once here; both shapes below build on it.
-- --------------------------------------------------------------------------
CREATE TEMP TABLE scoped ON COMMIT DROP AS
SELECT *
FROM report_news_item
WHERE :date_column >= date_trunc('day', now()) - make_interval(months => :months)
  AND (:report_profile_id = 0 OR report_profile_id = :report_profile_id);

CREATE INDEX ON scoped (id);

-- --------------------------------------------------------------------------
-- Shape 1: the rows themselves, every column, untouched.
-- --------------------------------------------------------------------------
CREATE TEMP TABLE export_articles ON COMMIT DROP AS
SELECT * FROM scoped;

-- --------------------------------------------------------------------------
-- Shape 2: one row per (article, distinct normalised keyword).
-- --------------------------------------------------------------------------
CREATE TEMP TABLE export_keywords ON COMMIT DROP AS
WITH split AS (
  SELECT s.id,
         k.ord,
         btrim(k.raw) AS keyword,
         -- 1. drop a possessive (apostrophe + s) at a word end.
         -- 2. fold every run of non-alphanumerics to a single space.
         -- [:alnum:] is Unicode-aware here, so accented mastheads survive.
         btrim(regexp_replace(
                 regexp_replace(lower(btrim(k.raw)), '[^[:alnum:][:space:]]s\M', '', 'g'),
                 '[^[:alnum:]]+', ' ', 'g')) AS keyword_norm
  FROM scoped s
  CROSS JOIN LATERAL unnest(string_to_array(s.matchedcriteria, ',')) WITH ORDINALITY AS k(raw, ord)
  WHERE s.matchedcriteria IS NOT NULL
    AND btrim(s.matchedcriteria) <> ''
),
deduped AS (
  -- One row per (article, normalised term). `keyword` stays a real string from
  -- the data: shortest raw spelling first, so a term listed as both "AMG" and
  -- "AMG's" reports as "AMG"; ord breaks ties so the choice is deterministic.
  SELECT DISTINCT ON (id, keyword_norm) id, keyword, keyword_norm
  FROM split
  WHERE keyword_norm <> ''
  ORDER BY id, keyword_norm, length(keyword), ord
)
SELECT
  s.id                AS report_news_item_id,
  s.news_item_id,
  s.report_id,
  s.report_profile_id,
  s.publication_id,
  s.source,
  s.category,
  s.pub_date::date    AS pub_date,
  s.report_date::date AS report_date,
  s.in_report,
  s.relevant,
  s.in_analysis,
  s.duplicate,
  s.syndicated,
  s.title,
  d.keyword,
  d.keyword_norm,
  -- Distinct terms on this article. The denominator for Jaccard / lift, and a
  -- quick way to drop single-keyword articles that cannot form a pair.
  count(*) OVER (PARTITION BY s.id) AS keywords_in_article
FROM deduped d
JOIN scoped s ON s.id = d.id;

-- --------------------------------------------------------------------------
-- Summary to stderr, so it survives a stdout redirect into the CSV.
-- --------------------------------------------------------------------------
SELECT (SELECT count(*) FROM scoped)::text                                     AS n_scoped,
       (SELECT count(*) FROM export_keywords)::text                            AS n_pairs,
       (SELECT count(DISTINCT report_news_item_id) FROM export_keywords)::text AS n_kw_articles,
       (SELECT count(DISTINCT keyword_norm) FROM export_keywords)::text        AS n_terms,
       (SELECT count(*) FROM scoped
         WHERE matchedcriteria IS NULL OR btrim(matchedcriteria) = '')::text   AS n_no_keywords,
       (SELECT coalesce(min(pub_date)::date::text, 'n/a') FROM scoped)         AS earliest,
       (SELECT coalesce(max(pub_date)::date::text, 'n/a') FROM scoped)         AS latest
\gset

\warn 'window:' :months 'months on' :date_column '| articles in scope:' :n_scoped '| pub_date' :earliest '..' :latest
\warn 'keywords:' :n_pairs 'pairs across' :n_kw_articles 'articles,' :n_terms 'distinct normalised terms'
\warn 'articles with no keywords (absent from the keywords shape):' :n_no_keywords
\warn 'emitting shape:' :shape

-- The \copy argument is read as a whole line, so it cannot carry a :variable --
-- hence one literal line per shape rather than one parameterised line.
\if :want_keywords
\copy (SELECT * FROM export_keywords ORDER BY report_news_item_id, keyword_norm) TO PSTDOUT WITH (FORMAT csv, HEADER true)
\else
\copy (SELECT * FROM export_articles ORDER BY id) TO PSTDOUT WITH (FORMAT csv, HEADER true)
\endif

COMMIT;
