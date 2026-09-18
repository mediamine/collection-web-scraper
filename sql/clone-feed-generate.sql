-- ============================================================================
--  clone-feed-generate.sql
--
--  Emits a ready-to-run INSERT script containing the *minimal FK closure* for a
--  single `feed` id, so the scrape workflows (WORKFLOW_COMPLETE_SCAN /
--  _PAGE_TEXT_SCAN / _RSS_SCAN) can run against a development database and
--  create news_item rows.
--
--  This file is READ-ONLY against its target. Run it on the SOURCE (reference
--  production) database; pipe its output into the DEV database.
--
--    psql "$PROD_URL" -X -q -At \
--         -v feed_id=1234 -v news_item_limit=25 -v recent_url_limit=50 \
--         -f sql/clone-feed-generate.sql -o feed-1234.sql
--
--    psql "$DEV_URL"  -X -v ON_ERROR_STOP=1 -f feed-1234.sql
--
--  Requires psql >= 12 (\warn, \if :{?var}).
--
--  Tables in the closure, in dependency order:
--    country
--    region                    (region.country_id -> country)
--    page_location_config      (feed.location_config_id -> ...)
--    tag
--    publication               (publication.domiciled_region_id -> region)
--    feed                      (-> publication, region, page_location_config)
--    publication_mediatype / _country / _region / _tag
--    feed_region / feed_tag / feed_recent_url / download_schedule
--    tag_tag
--    news_item                 (news_item.feed_fk -> feed)
--
--  Deliberately EXCLUDED (report/user domain — unreachable from a scrape run):
--    report_news_item, report_profile_feed, subscription, report, report_profile,
--    organisation, app_user*, measure*, vote, previously_output_news_item, ...
--    Cloning any of those would drag in the whole app_user/organisation graph.
--
--  Also excluded: all_feeds (a view), news_item_copy / news_item_temp /
--  old_news_item / old_previously_output_news_item (legacy scratch tables, not
--  FK-connected to feed).
-- ============================================================================

\if :{?feed_id}
\else
  \warn 'ABORT: pass a feed id, e.g. -v feed_id=1234'
  \quit
\endif

\if :{?news_item_limit}
\else
  \set news_item_limit 25
\endif

\if :{?recent_url_limit}
\else
  \set recent_url_limit 50
\endif

-- --------------------------------------------------------------------------
-- Pre-flight: the feed must exist and must have a parent publication.
-- --------------------------------------------------------------------------
SELECT EXISTS (SELECT 1 FROM feed WHERE id = :feed_id)                                AS src_feed_exists,
       EXISTS (SELECT 1 FROM feed WHERE id = :feed_id AND publication_id IS NOT NULL)  AS src_pub_exists
\gset

\if :src_feed_exists
\else
  \warn 'ABORT: no feed row with that id in the source database.'
  \quit
\endif

\if :src_pub_exists
\else
  \warn 'ABORT: that feed has publication_id = NULL. A feed must have a parent publication.'
  \quit
\endif

-- --------------------------------------------------------------------------
-- Generic row -> INSERT renderer. Column names/values are paired via jsonb, so
-- this stays correct no matter how many columns a table has.
--   * SQL NULL              -> NULL
--   * everything else       -> quote_literal() of its text form; unknown-typed
--                              literals are cast by the target column
--                              (bigint / boolean / timestamptz / numeric ...).
--   * to_jsonb() renders timestamptz as ISO-8601 *with offset*, so the emitted
--     script is independent of the session TimeZone on the dev side.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.to_insert(p_table text, p_row jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT format(
           'INSERT INTO %I (%s) VALUES (%s) ON CONFLICT DO NOTHING;',
           p_table,
           string_agg(quote_ident(e.k), ', ' ORDER BY e.ord),
           string_agg(CASE WHEN jsonb_typeof(e.v) = 'null'
                           THEN 'NULL'
                           ELSE quote_literal(e.v #>> '{}')
                      END, ', ' ORDER BY e.ord)
         )
  FROM jsonb_each(p_row) WITH ORDINALITY AS e(k, v, ord);
$fn$;

-- --------------------------------------------------------------------------
-- The closure.
-- --------------------------------------------------------------------------
WITH
f AS (
  SELECT * FROM feed WHERE id = :feed_id
),
pub AS (
  SELECT * FROM publication WHERE id = (SELECT publication_id FROM f)
),
plc AS (
  SELECT * FROM page_location_config WHERE id = (SELECT location_config_id FROM f)
),
fr AS (
  SELECT * FROM feed_region WHERE feed_id = (SELECT id FROM f)
),
pr AS (
  SELECT * FROM publication_region WHERE publication_id = (SELECT id FROM pub)
),
pc AS (
  SELECT * FROM publication_country WHERE publication_id = (SELECT id FROM pub)
),
pm AS (
  SELECT * FROM publication_mediatype WHERE owner_id = (SELECT id FROM pub)
),
ft AS (
  SELECT * FROM feed_tag WHERE feed_id = (SELECT id FROM f)
),
pt AS (
  SELECT * FROM publication_tag WHERE publication_id = (SELECT id FROM pub)
),
reg AS (
  SELECT * FROM region WHERE id IN (
    SELECT domiciled_region_id FROM f   WHERE domiciled_region_id IS NOT NULL
    UNION SELECT domiciled_region_id FROM pub WHERE domiciled_region_id IS NOT NULL
    UNION SELECT region_id           FROM fr
    UNION SELECT region_id           FROM pr
  )
),
cty AS (
  SELECT * FROM country WHERE id IN (
    SELECT country_id FROM reg
    UNION SELECT country_id FROM pc
  )
),
tg AS (
  SELECT * FROM tag WHERE id IN (
    SELECT tag_id FROM ft
    UNION SELECT tag_id FROM pt
  )
),
-- Only edges whose BOTH endpoints are already in the tag set. The tag_tag graph
-- is not walked transitively: nothing in the scrapers reads tags, so expanding
-- the hierarchy would grow the clone without making any workflow testable.
tt AS (
  SELECT * FROM tag_tag
  WHERE tag_id IN (SELECT id FROM tg) AND related_id IN (SELECT id FROM tg)
),
fru AS (
  SELECT * FROM feed_recent_url
  WHERE owner_id = (SELECT id FROM f)
  ORDER BY url
  LIMIT :recent_url_limit
),
ds AS (
  SELECT * FROM download_schedule WHERE feed_fk = (SELECT id FROM f)
),
ni AS (
  SELECT * FROM news_item
  WHERE feed_fk = (SELECT id FROM f)
  ORDER BY date_downloaded DESC NULLS LAST, id DESC
  LIMIT :news_item_limit
),
script(ord, seq, stmt) AS (
              SELECT 0::int, 0::bigint, format('-- minimal feed closure generated %s', now())
  UNION ALL   SELECT 0, 1, format('-- source feed : %s (%L)', f.id, f.name) FROM f
  UNION ALL   SELECT 0, 2, format('-- publication : %s (%L)', pub.id, pub.name) FROM pub
  UNION ALL   SELECT 0, 3, '-- ids are preserved from the source db so FEEDS_TO_IDS_* config works unchanged'
  UNION ALL   SELECT 1, 0, 'BEGIN;'

  UNION ALL   SELECT 10, 0, '-- country'
  UNION ALL   SELECT 10, row_number() OVER (ORDER BY id), pg_temp.to_insert('country', to_jsonb(cty)) FROM cty

  UNION ALL   SELECT 20, 0, '-- region'
  UNION ALL   SELECT 20, row_number() OVER (ORDER BY id), pg_temp.to_insert('region', to_jsonb(reg)) FROM reg

  UNION ALL   SELECT 30, 0, '-- page_location_config'
  UNION ALL   SELECT 30, row_number() OVER (ORDER BY id), pg_temp.to_insert('page_location_config', to_jsonb(plc)) FROM plc

  UNION ALL   SELECT 40, 0, '-- tag'
  UNION ALL   SELECT 40, row_number() OVER (ORDER BY id), pg_temp.to_insert('tag', to_jsonb(tg)) FROM tg

  UNION ALL   SELECT 50, 0, '-- publication (parent of feed)'
  UNION ALL   SELECT 50, row_number() OVER (ORDER BY id), pg_temp.to_insert('publication', to_jsonb(pub)) FROM pub

  UNION ALL   SELECT 60, 0, '-- feed'
  UNION ALL   SELECT 60, 1, pg_temp.to_insert('feed', to_jsonb(f)) FROM f

  UNION ALL   SELECT 70, 0, '-- publication satellites'
  UNION ALL   SELECT 70, row_number() OVER (ORDER BY mediatype),      pg_temp.to_insert('publication_mediatype', to_jsonb(pm)) FROM pm
  UNION ALL   SELECT 71, row_number() OVER (ORDER BY country_id),     pg_temp.to_insert('publication_country',   to_jsonb(pc)) FROM pc
  UNION ALL   SELECT 72, row_number() OVER (ORDER BY region_id),      pg_temp.to_insert('publication_region',    to_jsonb(pr)) FROM pr
  UNION ALL   SELECT 73, row_number() OVER (ORDER BY tag_id),         pg_temp.to_insert('publication_tag',       to_jsonb(pt)) FROM pt

  UNION ALL   SELECT 80, 0, '-- feed satellites'
  UNION ALL   SELECT 80, row_number() OVER (ORDER BY region_id),      pg_temp.to_insert('feed_region',       to_jsonb(fr))  FROM fr
  UNION ALL   SELECT 81, row_number() OVER (ORDER BY tag_id),         pg_temp.to_insert('feed_tag',          to_jsonb(ft))  FROM ft
  UNION ALL   SELECT 82, row_number() OVER (ORDER BY url),            pg_temp.to_insert('feed_recent_url',   to_jsonb(fru)) FROM fru
  UNION ALL   SELECT 83, row_number() OVER (ORDER BY id),             pg_temp.to_insert('download_schedule', to_jsonb(ds))  FROM ds

  UNION ALL   SELECT 90, 0, '-- tag_tag (edges internal to the cloned tag set)'
  UNION ALL   SELECT 90, row_number() OVER (ORDER BY tag_id, related_id), pg_temp.to_insert('tag_tag', to_jsonb(tt)) FROM tt

  UNION ALL   SELECT 100, 0, '-- news_item sample for this feed'
  UNION ALL   SELECT 100, row_number() OVER (ORDER BY id), pg_temp.to_insert('news_item', to_jsonb(ni)) FROM ni

  -- CompleteScanService / RssScanService both call
  --   news_item.findFirstOrThrow({ orderBy: { id: 'desc' } })
  -- to derive the next manual id. On a news_item table that is entirely empty
  -- that throws, and scan() swallows the error -> the workflow silently does
  -- nothing. This inert bootstrap row guarantees max(id) exists. feed_fk is
  -- NULL and page_text is non-empty, so no workflow will ever pick it up.
  UNION ALL   SELECT 110, 0, '-- bootstrap row so news_item is never empty (satisfies findFirstOrThrow)'
  UNION ALL   SELECT 110, 1, $b$INSERT INTO news_item (id, link, title, description, source, date, date_downloaded, feed_fk, hashcode, page_text)
SELECT 1, NULL, '[dev bootstrap]', NULL, NULL, now() - interval '10 years', now() - interval '10 years', NULL, -1, '[dev bootstrap]'
WHERE NOT EXISTS (SELECT 1 FROM news_item)
ON CONFLICT DO NOTHING;$b$

  UNION ALL   SELECT 120, 0, '-- post-conditions'
  UNION ALL   SELECT 120, 1,
                format($a$DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feed WHERE id = %s) THEN
    RAISE EXCEPTION 'clone failed: feed %s missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feed fe JOIN publication p ON p.id = fe.publication_id WHERE fe.id = %s) THEN
    RAISE EXCEPTION 'clone failed: feed %s has no parent publication';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM news_item) THEN
    RAISE EXCEPTION 'clone failed: news_item is empty, findFirstOrThrow will abort every scan';
  END IF;
END $$;$a$, f.id, f.id, f.id, f.id)
              FROM f

  UNION ALL   SELECT 130, 0, 'COMMIT;'

  -- Optional, uncomment on the dev side to give the workflows something to do.
  UNION ALL   SELECT 140, 0, ''
  UNION ALL   SELECT 140, 1, '-- Optional: re-arm the cloned items so the scan picks them up.'
  UNION ALL   SELECT 140, 2, format($c$-- WORKFLOW_PAGE_TEXT_SCAN only looks at rows where
--   page_text IN ('', NULL) AND date_downloaded >= now() - interval '1 month'
-- UPDATE news_item SET page_text = '', date_downloaded = now() WHERE feed_fk = %s;
-- UPDATE feed SET last_download_date = NULL WHERE id = %s;$c$, f.id, f.id)
              FROM f
)
SELECT stmt FROM script ORDER BY ord, seq;
