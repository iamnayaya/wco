-- =============================================================================
-- WCO · DOWN · 0001_init_full_schema
-- =============================================================================
-- ⚠️  DESTROYS ALL DATA. Development/testing only.
-- Order matters: children before parents, enums last.
-- Usage: psql "$DATABASE_URL" -f prisma/sql/down/0001_init_full_schema.down.sql
-- =============================================================================

BEGIN;

-- Analytics & compliance -------------------------------------------------------
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "webhook_subscriptions" CASCADE;
DROP TABLE IF EXISTS "outbox_events" CASCADE;
DROP TABLE IF EXISTS "daily_store_metrics" CASCADE;
DROP TABLE IF EXISTS "analytics_events" CASCADE;

-- AI ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "ai_responses" CASCADE;
DROP TABLE IF EXISTS "ai_configurations" CASCADE;
DROP TABLE IF EXISTS "price_suggestions" CASCADE;
DROP TABLE IF EXISTS "demand_forecasts" CASCADE;

-- Marketing --------------------------------------------------------------------
DROP TABLE IF EXISTS "campaign_messages" CASCADE;
DROP TABLE IF EXISTS "campaigns" CASCADE;
DROP TABLE IF EXISTS "automation_rules" CASCADE;

-- Messaging --------------------------------------------------------------------
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "conversations" CASCADE;

-- Logistics & payments ---------------------------------------------------------
DROP TABLE IF EXISTS "deliveries" CASCADE;
DROP TABLE IF EXISTS "delivery_providers" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;

-- Orders & catalog ---------------------------------------------------------------
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "customers" CASCADE;

-- Billing ------------------------------------------------------------------------
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "subscription_plans" CASCADE;
DROP TABLE IF EXISTS "payment_methods" CASCADE;

-- Identity & tenancy -------------------------------------------------------------
DROP TABLE IF EXISTS "stores" CASCADE;
DROP TABLE IF EXISTS "api_tokens" CASCADE;
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "merchants" CASCADE;

-- Enums ----------------------------------------------------------------------------
DROP TYPE IF EXISTS "AiTemplateCategory";
DROP TYPE IF EXISTS "AiTone";
DROP TYPE IF EXISTS "BillingCycle";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "PayoutVerificationStatus";
DROP TYPE IF EXISTS "PaymentMethodType";
DROP TYPE IF EXISTS "Sentiment";
DROP TYPE IF EXISTS "AutomationTrigger";
DROP TYPE IF EXISTS "CampaignStatus";
DROP TYPE IF EXISTS "CampaignType";
DROP TYPE IF EXISTS "ConversationStatus";
DROP TYPE IF EXISTS "MessageStatus";
DROP TYPE IF EXISTS "MessageType";
DROP TYPE IF EXISTS "MessageDirection";
DROP TYPE IF EXISTS "DeliveryStatus";
DROP TYPE IF EXISTS "LogisticsCarrier";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "PaymentProvider";
DROP TYPE IF EXISTS "OrderChannel";
DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "Currency";
DROP TYPE IF EXISTS "ProductStatus";
DROP TYPE IF EXISTS "StoreStatus";
DROP TYPE IF EXISTS "PlanTier";
DROP TYPE IF EXISTS "UserRole";

COMMIT;
