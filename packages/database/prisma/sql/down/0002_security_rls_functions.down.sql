-- =============================================================================
-- WCO · DOWN · 0002_security_rls_functions
-- =============================================================================
-- Removes all objects introduced by 0002. Run as superuser / wco_migrator.
-- Usage: psql "$DATABASE_URL" -f prisma/sql/down/0002_security_rls_functions.down.sql
-- =============================================================================

BEGIN;

-- 7 · Maintenance helpers ------------------------------------------------------
DROP FUNCTION IF EXISTS ensure_monthly_partition(REGCLASS, DATE);

-- 6 · View, helper indexes, partial unique ------------------------------------
DROP VIEW IF EXISTS message_threads;
DROP INDEX IF EXISTS subscriptions_one_live_per_merchant_uidx;
DROP INDEX IF EXISTS customers_waphone_prefix_idx;
DROP INDEX IF EXISTS customers_name_trgm_idx;
DROP INDEX IF EXISTS products_name_trgm_idx;

-- 4 · Policies & RLS ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores','categories','products','customers','orders','payments','deliveries',
    'conversations','automation_rules','campaigns','price_suggestions',
    'demand_forecasts','daily_store_metrics','analytics_events',
    'webhook_subscriptions','messages','order_items','campaign_messages',
    'users','refresh_tokens','api_tokens','payment_methods','subscriptions',
    'ai_configurations','ai_responses','audit_logs','merchants'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS system_templates_readable ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_templates_writable ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS audit_read_own ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS self_read ON %I', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 3 · updated_at triggers -------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'merchants','users','stores','products','product_variants',
    'customers','orders','payments','deliveries','conversations',
    'automation_rules','campaigns','price_suggestions','ai_configurations',
    'ai_responses','payment_methods','subscriptions','subscription_plans',
    'webhook_subscriptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON %I', t, t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS fn_touch_updated_at();

-- 2 · Tenant helpers -------------------------------------------------------------
DROP FUNCTION IF EXISTS set_tenant(TEXT, TEXT);
DROP FUNCTION IF EXISTS current_store_id();
DROP FUNCTION IF EXISTS current_merchant_id();

-- 1 · Roles ----------------------------------------------------------------------
-- Revoking logins is deliberate; role drop requires terminating connections.
ALTER ROLE wco_migrator NOLOGIN;
ALTER ROLE wco_app NOLOGIN;
ALTER ROLE wco_readonly NOLOGIN;

COMMIT;
