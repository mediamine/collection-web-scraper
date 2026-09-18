-- ============================================================================
--  export-report-news-item-keywords.dbeaver.sql
--
--  A GUI-runnable derivative of export-report-news-item-keywords.sql, for
--  DBeaver / pgAdmin / DataGrip. Same window, same keyword splitting, same
--  normalisation -- but as two plain SELECTs instead of a psql script, because
--  \set / \if / \gset / \copy are psql client commands that no SQL client other
--  than psql implements.
--
--  export-report-news-item-keywords.sql stays the authoritative one: it is what
--  a scheduled or scripted export should run, it validates its arguments, and
--  it reports a summary. If you change the keyword logic, change it there too.
--
--  Differences forced by dropping out of psql:
--    * Options are literals in the `params` CTE below, not -v arguments. Edit
--      them in place.
--    * date_column becomes a CASE over the three candidate columns rather than
--      an interpolated identifier. Correct, but it costs the index on
--      report_date / pub_date, so a wide window over a large table will seq
--      scan. Swap the CASE for a direct `r.report_date >= ...` if that bites.
--    * Timezone is pinned per-expression with AT TIME ZONE instead of
--      SET LOCAL TimeZone, so the dates are NZ calendar dates no matter how the
--      client session is configured.
--    * No CSV is written. Export the result grid from the client -- in DBeaver,
--      right-click the query and choose Execute > Export from query.
--
--  Run ONE statement at a time: put the cursor inside it and press Ctrl+Enter.
--  Alt+X runs the whole file and you get two result tabs.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Shape 1 of 2: the rows themselves, every column, untouched.
-- ---------------------------------------------------------------------------
WITH params AS (
  SELECT 6                   AS months,             -- trailing window size
         'report_date'::text AS date_basis,         -- report_date | pub_date | analysis_completed
         0::bigint           AS report_profile_id   -- 0 = every profile
)
SELECT r.*
FROM report_news_item r
CROSS JOIN params p
WHERE CASE p.date_basis
         WHEN 'report_date'        THEN r.report_date
         WHEN 'pub_date'           THEN r.pub_date
         WHEN 'analysis_completed' THEN r.analysis_completed
       END >= date_trunc('day', now()) - make_interval(months => p.months)
  AND (p.report_profile_id = 0 OR r.report_profile_id = p.report_profile_id)
ORDER BY r.id;


-- ---------------------------------------------------------------------------
-- Shape 2 of 2: one row per (article, distinct normalised keyword).
-- This is the one to feed the co-occurrence analysis.
-- ---------------------------------------------------------------------------
WITH params AS (
  SELECT 6                   AS months,
         'report_date'::text AS date_basis,
         0::bigint           AS report_profile_id
),
scoped AS (
  SELECT r.*
  FROM report_news_item r
  CROSS JOIN params p
  WHERE CASE p.date_basis
           WHEN 'report_date'        THEN r.report_date
           WHEN 'pub_date'           THEN r.pub_date
           WHEN 'analysis_completed' THEN r.analysis_completed
         END >= date_trunc('day', now()) - make_interval(months => p.months)
    AND (p.report_profile_id = 0 OR r.report_profile_id = p.report_profile_id)
),
split AS (
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
  -- One row per (article, normalised term). Shortest raw spelling wins, so a
  -- term listed as both "AMG" and "AMG's" reports as "AMG"; ord breaks ties.
  SELECT DISTINCT ON (id, keyword_norm) id, keyword, keyword_norm
  FROM split
  WHERE keyword_norm <> ''
  ORDER BY id, keyword_norm, length(keyword), ord
)
SELECT
  s.id                                                AS report_news_item_id,
  s.news_item_id,
  s.report_id,
  s.report_profile_id,
  s.publication_id,
  s.source,
  s.category,
  (s.pub_date    AT TIME ZONE 'Pacific/Auckland')::date AS pub_date,
  (s.report_date AT TIME ZONE 'Pacific/Auckland')::date AS report_date,
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
  count(*) OVER (PARTITION BY s.id)                   AS keywords_in_article
FROM deduped d
JOIN scoped s ON s.id = d.id
ORDER BY report_news_item_id, keyword_norm;
