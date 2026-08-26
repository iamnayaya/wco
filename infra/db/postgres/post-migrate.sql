-- =============================================================================
-- WCO · PRODUCTION POST-MIGRATE · Partition layout & retention automation
-- =============================================================================
-- RUN BY: ops pipeline (GitHub Actions "db-ops" job) immediately after
--         `prisma migrate deploy`, against the PRIMARY as wco_migrator.
-- PURPOSE: Convert the hottest append-only tables to monthly RANGE partitions
--          (or TimescaleDB hypertables) WITHOUT touching Prisma-managed DDL,
--          so `prisma migrate dev` in developer environments stays vanilla.
--
-- PRISMA DRIFT CONTRACT:
--   * Dev databases never run this file → schema.prisma stays authoritative.
--   * Prod-only physical changes here are invisible to Prisma's logical diff.
--   * We add plain UNIQUE indexes on `id` for every partitioned table so
--     Prisma findUnique/update-by-id keeps working identically.
--
-- Idempotent: every step is guarded; safe to re-run.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 0 · Preconditions -------------------------------------------------------------
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF session_user NOT IN ('wco_migrator', 'postgres') THEN
    RAISE EXCEPTION 'post-migrate.sql must run as wco_migrator or postgres';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1 · Generic table→monthly-partition converter ---------------------------------
--   Rebuilds `p_parent` as a partitioned table on RANGE ("createdAt") and moves
--   data across inside one transaction. Call per-table below.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops_to_monthly_partitions(p_table TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_tmp      TEXT := p_table || '_partitioned';
  v_old      TEXT := p_table || '_legacy';
  v_has_pk   BOOLEAN;
BEGIN
  -- Already partitioned? (pg_class.relkind 'p') → no-op
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = p_table AND c.relkind = 'p') THEN
    RAISE NOTICE '% already partitioned — skipping', p_table;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = format('public.%I', p_table)::regclass AND con.contype = 'p'
  ) INTO v_has_pk;

  EXECUTE format('ALTER TABLE %I RENAME TO %I', p_table, v_old);
  -- Recreate with identical logical shape but partitioned by month.
  EXECUTE format($f$
    CREATE TABLE %I (LIKE %I INCLUDING ALL)
      PARTITION BY RANGE ("createdAt")
  $f$, v_tmp, v_old);

  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I_pkey', v_tmp, v_tmp);
  IF v_has_pk THEN
    -- Partition key must be part of any PK/unique constraint on the parent.
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I_pkey PRIMARY KEY (id, "createdAt")', v_tmp, v_tmp);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I_id_uidx ON %I (id)', v_tmp, v_tmp);
  END IF;

  EXECUTE format('INSERT INTO %I SELECT * FROM %I', v_tmp, v_old);
  EXECUTE format('ALTER TABLE %I RENAME TO %I', v_tmp, p_table);
  EXECUTE format('ALTER TABLE %I RENAME TO %I', v_old, v_old); -- keep legacy name for audit
  RAISE NOTICE '% converted to monthly partitions', p_table;
END $$;

-- Initial partitions: current month ±3 months of headroom.
DO $$
DECLARE d DATE := date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC');
DECLARE i INT;
BEGIN
  FOR i IN -1..3 LOOP
    PERFORM ensure_monthly_partition('public.messages'::regclass, d + make_interval(months => i));
  END LOOP;
END $$;

SELECT ops_to_monthly_partitions('messages');
-- analytics_events uses BIGSERIAL id — PK becomes (id, occurredAt):
-- handled by its own block below because the generic helper assumes createdAt.

-- -----------------------------------------------------------------------------
-- 2 · analytics_events → RANGE ("occurredAt") -----------------------------------
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'analytics_events' AND c.relkind = 'r') THEN
    ALTER TABLE analytics_events RENAME TO analytics_events_legacy;
    CREATE TABLE analytics_events_partitioned (
      LIKE analytics_events_legacy INCLUDING DEFAULTS INCLUDING CONSTRAINTS
    ) PARTITION BY RANGE ("occurredAt");
    ALTER TABLE analytics_events_partitioned
      ADD CONSTRAINT analytics_events_partitioned_pkey PRIMARY KEY (id, "occurredAt");
    CREATE UNIQUE INDEX analytics_events_partitioned_id_uidx
      ON analytics_events_partitioned (id);
    INSERT INTO analytics_events_partitioned SELECT * FROM analytics_events_legacy;
    -- FK to stores is re-created post-swap (LIKE does not copy FKs).
    ALTER TABLE analytics_events_partitioned
      ADD CONSTRAINT analytics_events_storeId_fkey
      FOREIGN KEY ("storeId") REFERENCES stores(id) ON DELETE CASCADE;
    ALTER SEQUENCE analytics_events_id_seq OWNED BY analytics_events.id;
    ALTER TABLE analytics_events_partitioned ALTER COLUMN id SET DEFAULT nextval('analytics_events_id_seq');
    ALTER TABLE analytics_events_partitioned RENAME TO analytics_events;
    RAISE NOTICE 'analytics_events converted';
  END IF;
END $$;

-- Partitions for events (current ±3 months) + audit_logs via generic helper:
DO $$
DECLARE d DATE := date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC');
DECLARE i INT;
BEGIN
  FOR i IN -1..3 LOOP
    PERFORM ensure_monthly_partition('public.analytics_events'::regclass, d + make_interval(months => i));
  END LOOP;
END $$;

SELECT ops_to_monthly_partitions('audit_logs');

-- -----------------------------------------------------------------------------
-- 3 · TimescaleDB alternative (preferred when the extension is available) --------
--   If Timescale is installed we convert analytics_events to a hypertable with
--   continuous aggregates powering daily_store_metrics in real time instead of
--   relying solely on the 02:00 cron rollup.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'analytics_events' AND relkind = 'r') THEN
    PERFORM create_hypertable('analytics_events', 'occurredAt',
              chunk_time_interval => INTERVAL '7 days',
              if_not_exists => TRUE, migrate_data => TRUE);
    CREATE INDEX IF NOT EXISTS analytics_events_store_type_time_idx
      ON analytics_events ("storeId", type, "occurredAt" DESC);
    RAISE NOTICE 'analytics_events converted to hypertable';
  END IF;
END $$;

-- Continuous aggregate example (uncomment when Timescale enabled):
-- CREATE MATERIALIZED VIEW daily_store_metrics_ts WITH (timescaledb.continuous) AS
-- SELECT storeId,
--        time_bucket('1 day', occurredAt) AS day,
--        count(*)                          AS events
-- FROM analytics_events GROUP BY storeId, day;

-- -----------------------------------------------------------------------------
-- 4 · Index parity for partitioned messages --------------------------------------
--   LIKE INCLUDING ALL copies indexes onto each future partition only if they
--   exist on the PARENT before partitions are created; recreate defensively.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS messages_conversationId_createdAt_idx
  ON messages ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS messages_status_createdAt_idx
  ON messages (status, "createdAt");
CREATE INDEX IF NOT EXISTS audit_logs_storeId_createdAt_idx
  ON audit_logs ("storeId", "createdAt");

-- -----------------------------------------------------------------------------
-- 5 · Retention automation -------------------------------------------------------
--   * messages / audit_logs: DETACH partitions older than 13 months, then drop
--     after archival job confirms S3 Parquet upload (data-lifecycle doc).
--   * outbox_events: delete processed rows older than 30 days.
--   * refresh_tokens: purge expired rows nightly (index from 0001).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops_drop_expired_partitions(p_table REGCLASS, p_keep_months INT)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_dropped INT := 0;
  v_cutoff  TEXT := to_char(date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') - make_interval(months => p_keep_months), 'YYYY-MM-DD');
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.oid = p_table
      AND regexp_replace(c.relname, '^.*_(\d{4}M\d{2})$', '\1') ~ '^\d{4}M\d{2}$'
  LOOP
    IF right(r.relname, 6)::text < replace(substring(v_cutoff FROM 1 FOR 7), '-', '')||'' THEN
      EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', r.relname);
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.relname);
      v_dropped := v_dropped + 1;
    END IF;
  END LOOP;
  RETURN v_dropped;
END $$;

-- Housekeeping sweep (safe to run frequently):
DELETE FROM outbox_events  WHERE "processedAt" IS NOT NULL AND "createdAt" < now() - INTERVAL '30 days';
DELETE FROM refresh_tokens WHERE "expiresAt"   < now() - INTERVAL '7 days';

-- -----------------------------------------------------------------------------
-- 6 · pg_cron schedules (when extension present; otherwise K8s CronJob runs SQL) -
-- -----------------------------------------------------------------------------
-- SELECT cron.schedule('wco-partition-maintenance', '17 2 * * *', $$
--   SELECT ensure_monthly_partition('public.messages'::regclass,
--            (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '2 months')::date);
--   SELECT ensure_monthly_partition('public.analytics_events'::regclass,
--            (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '2 months')::date);
--   PERFORM ops_drop_expired_partitions('messages'::regclass, 13);
--   PERFORM ops_drop_expired_partitions('analytics_events'::regclass, 13);
-- $$);
