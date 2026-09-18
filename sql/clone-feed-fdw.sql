-- ============================================================================
--  clone-feed-fdw.sql
--
--  Same minimal feed closure as clone-feed-generate.sql, but executed ON THE
--  DEVELOPMENT DATABASE, pulling rows straight out of the reference production
--  database over postgres_fdw. Use this when the dev box can reach prod;
--  otherwise use clone-feed-generate.sql (no connectivity required).
--
--    psql "$DEV_URL" -X -v ON_ERROR_STOP=1 \
--         -v feed_id=1234 \
--         -v src_host=prod.db.internal -v src_port=5432 -v src_db=mediamine \
--         -v src_user=readonly -v src_pass=secret \
--         -v news_item_limit=25 -v recent_url_limit=50 \
--         -f sql/clone-feed-fdw.sql
--
--  Everything runs in one transaction; on any error nothing is committed.
--  Every INSERT is ON CONFLICT DO NOTHING, so re-running is safe.
--
--  NOTE: the source role only ever needs SELECT. Nothing here writes to prod.
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
-- 1. Wire up the foreign schema (idempotent).
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS mm_src CASCADE;

CREATE SERVER mm_src
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host :'src_host', port :'src_port', dbname :'src_db');

CREATE USER MAPPING FOR CURRENT_USER
  SERVER mm_src
  OPTIONS (user :'src_user', password :'src_pass');

CREATE SCHEMA IF NOT EXISTS mm_src;

IMPORT FOREIGN SCHEMA public
  LIMIT TO (country, region, page_location_config, tag, tag_tag,
            publication, publication_mediatype, publication_country,
            publication_region, publication_tag,
            feed, feed_region, feed_tag, feed_recent_url, download_schedule,
            news_item)
  FROM SERVER mm_src INTO mm_src;

-- --------------------------------------------------------------------------
-- 2. Pre-flight: feed must exist upstream and must have a parent publication.
-- --------------------------------------------------------------------------
SELECT EXISTS (SELECT 1 FROM mm_src.feed WHERE id = :feed_id)                               AS src_feed_exists,
       EXISTS (SELECT 1 FROM mm_src.feed WHERE id = :feed_id AND publication_id IS NOT NULL) AS src_pub_exists
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

BEGIN;

-- psql does NOT interpolate :vars inside dollar-quoted strings, so hand the id
-- to the post-condition DO block via a GUC instead.
SET LOCAL mm.feed_id = :'feed_id';

-- Materialise the closure once, so each INSERT below reads local temp tables
-- instead of hitting the foreign server repeatedly.
CREATE TEMP TABLE _f            ON COMMIT DROP AS SELECT * FROM mm_src.feed WHERE id = :feed_id;
CREATE TEMP TABLE _pub          ON COMMIT DROP AS SELECT * FROM mm_src.publication          WHERE id      = (SELECT publication_id     FROM _f);
CREATE TEMP TABLE _plc          ON COMMIT DROP AS SELECT * FROM mm_src.page_location_config WHERE id      = (SELECT location_config_id FROM _f);
CREATE TEMP TABLE _fr           ON COMMIT DROP AS SELECT * FROM mm_src.feed_region          WHERE feed_id = (SELECT id FROM _f);
CREATE TEMP TABLE _ft           ON COMMIT DROP AS SELECT * FROM mm_src.feed_tag             WHERE feed_id = (SELECT id FROM _f);
CREATE TEMP TABLE _ds           ON COMMIT DROP AS SELECT * FROM mm_src.download_schedule    WHERE feed_fk = (SELECT id FROM _f);
CREATE TEMP TABLE _pm           ON COMMIT DROP AS SELECT * FROM mm_src.publication_mediatype WHERE owner_id      = (SELECT id FROM _pub);
CREATE TEMP TABLE _pc           ON COMMIT DROP AS SELECT * FROM mm_src.publication_country   WHERE publication_id = (SELECT id FROM _pub);
CREATE TEMP TABLE _pr           ON COMMIT DROP AS SELECT * FROM mm_src.publication_region    WHERE publication_id = (SELECT id FROM _pub);
CREATE TEMP TABLE _pt           ON COMMIT DROP AS SELECT * FROM mm_src.publication_tag       WHERE publication_id = (SELECT id FROM _pub);

CREATE TEMP TABLE _reg ON COMMIT DROP AS
  SELECT * FROM mm_src.region WHERE id IN (
    SELECT domiciled_region_id FROM _f   WHERE domiciled_region_id IS NOT NULL
    UNION SELECT domiciled_region_id FROM _pub WHERE domiciled_region_id IS NOT NULL
    UNION SELECT region_id FROM _fr
    UNION SELECT region_id FROM _pr
  );

CREATE TEMP TABLE _cty ON COMMIT DROP AS
  SELECT * FROM mm_src.country WHERE id IN (
    SELECT country_id FROM _reg
    UNION SELECT country_id FROM _pc
  );

CREATE TEMP TABLE _tg ON COMMIT DROP AS
  SELECT * FROM mm_src.tag WHERE id IN (
    SELECT tag_id FROM _ft
    UNION SELECT tag_id FROM _pt
  );

-- Edges internal to the cloned tag set only; the hierarchy is not walked
-- transitively (no scraper reads tags).
CREATE TEMP TABLE _tt ON COMMIT DROP AS
  SELECT * FROM mm_src.tag_tag
  WHERE tag_id IN (SELECT id FROM _tg) AND related_id IN (SELECT id FROM _tg);

CREATE TEMP TABLE _fru ON COMMIT DROP AS
  SELECT * FROM mm_src.feed_recent_url
  WHERE owner_id = (SELECT id FROM _f)
  ORDER BY url LIMIT :recent_url_limit;

CREATE TEMP TABLE _ni ON COMMIT DROP AS
  SELECT * FROM mm_src.news_item
  WHERE feed_fk = (SELECT id FROM _f)
  ORDER BY date_downloaded DESC NULLS LAST, id DESC
  LIMIT :news_item_limit;

-- --------------------------------------------------------------------------
-- 3. Insert in FK-safe order. Ids are preserved from the source database so
--    the FEEDS_TO_IDS_* env config works unchanged against the dev db.
-- --------------------------------------------------------------------------

INSERT INTO country (id, name, code, enabled)
SELECT id, name, code, enabled FROM _cty
ON CONFLICT DO NOTHING;

INSERT INTO region (id, name, country_id, enabled)
SELECT id, name, country_id, enabled FROM _reg
ON CONFLICT DO NOTHING;

INSERT INTO page_location_config (id, name, container_selector, link_selector,
                                 title_selector, description_selector, sample_url, date_selector)
SELECT id, name, container_selector, link_selector,
       title_selector, description_selector, sample_url, date_selector FROM _plc
ON CONFLICT DO NOTHING;

INSERT INTO tag (id, name, purpose)
SELECT id, name, purpose FROM _tg
ON CONFLICT DO NOTHING;

-- parent publication
INSERT INTO publication (id, name, url, readership, page_parser, domiciled_region_id)
SELECT id, name, url, readership, page_parser, domiciled_region_id FROM _pub
ON CONFLICT DO NOTHING;

INSERT INTO feed (id, name, url, default_refresh_period, broken_url, version,
                  last_download_date, feed_type, twitter_id, title_selector,
                  description_selector, page_text_selector, store_tweets,
                  location_config_id, client_searchable, publication_id, complicated,
                  page_parser, breaking_news, enabled, manual, domiciled_region_id,
                  mediatype, reach)
SELECT id, name, url, default_refresh_period, broken_url, version,
       last_download_date, feed_type, twitter_id, title_selector,
       description_selector, page_text_selector, store_tweets,
       location_config_id, client_searchable, publication_id, complicated,
       page_parser, breaking_news, enabled, manual, domiciled_region_id,
       mediatype, reach
FROM _f
ON CONFLICT DO NOTHING;

-- publication satellites
INSERT INTO publication_mediatype (owner_id, mediatype)
SELECT owner_id, mediatype FROM _pm ON CONFLICT DO NOTHING;

INSERT INTO publication_country (publication_id, country_id)
SELECT publication_id, country_id FROM _pc ON CONFLICT DO NOTHING;

INSERT INTO publication_region (publication_id, region_id)
SELECT publication_id, region_id FROM _pr ON CONFLICT DO NOTHING;

INSERT INTO publication_tag (publication_id, tag_id)
SELECT publication_id, tag_id FROM _pt ON CONFLICT DO NOTHING;

-- feed satellites
INSERT INTO feed_region (feed_id, region_id)
SELECT feed_id, region_id FROM _fr ON CONFLICT DO NOTHING;

INSERT INTO feed_tag (feed_id, tag_id)
SELECT feed_id, tag_id FROM _ft ON CONFLICT DO NOTHING;

INSERT INTO feed_recent_url (owner_id, url)
SELECT owner_id, url FROM _fru ON CONFLICT DO NOTHING;

INSERT INTO download_schedule (id, feed_fk, next_download_time)
SELECT id, feed_fk, next_download_time FROM _ds ON CONFLICT DO NOTHING;

INSERT INTO tag_tag (tag_id, related_id)
SELECT tag_id, related_id FROM _tt ON CONFLICT DO NOTHING;

-- news_item sample for this feed
INSERT INTO news_item (id, link, title, description, source, date, date_downloaded,
                       feed_fk, hashcode, page_text)
SELECT id, link, title, description, source, date, date_downloaded,
       feed_fk, hashcode, page_text
FROM _ni
ON CONFLICT DO NOTHING;

-- CompleteScanService / RssScanService both call
--   news_item.findFirstOrThrow({ orderBy: { id: 'desc' } })
-- to derive the next manual id. On an entirely empty news_item table that
-- throws, and scan() swallows the error -> the workflow silently does nothing.
-- This inert bootstrap row guarantees max(id) exists. feed_fk is NULL and
-- page_text is non-empty, so no workflow will ever pick it up.
INSERT INTO news_item (id, link, title, description, source, date, date_downloaded,
                       feed_fk, hashcode, page_text)
SELECT 1, NULL, '[dev bootstrap]', NULL, NULL,
       now() - interval '10 years', now() - interval '10 years', NULL, -1, '[dev bootstrap]'
WHERE NOT EXISTS (SELECT 1 FROM news_item)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 4. Post-conditions.
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_feed_id bigint := current_setting('mm.feed_id')::bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feed WHERE id = v_feed_id) THEN
    RAISE EXCEPTION 'clone failed: feed % missing', v_feed_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feed f JOIN publication p ON p.id = f.publication_id
                 WHERE f.id = v_feed_id) THEN
    RAISE EXCEPTION 'clone failed: feed % has no parent publication', v_feed_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM news_item) THEN
    RAISE EXCEPTION 'clone failed: news_item is empty, findFirstOrThrow will abort every scan';
  END IF;
END $$;

COMMIT;

-- --------------------------------------------------------------------------
-- 5. Optional: re-arm the cloned items so a scan has something to do.
--    WORKFLOW_PAGE_TEXT_SCAN only looks at rows where
--      page_text IN ('', NULL) AND date_downloaded >= now() - interval '1 month'
-- --------------------------------------------------------------------------
-- UPDATE news_item SET page_text = '', date_downloaded = now() WHERE feed_fk = :feed_id;
-- UPDATE feed SET last_download_date = NULL WHERE id = :feed_id;

-- Drop the FDW link once you are done pulling.
-- DROP SERVER IF EXISTS mm_src CASCADE;
-- DROP SCHEMA  IF EXISTS mm_src CASCADE;
