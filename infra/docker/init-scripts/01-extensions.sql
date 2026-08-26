-- WCO local dev bootstrap — runs once on first container init
-- (mounted via infra/docker/docker-compose.yml → /docker-entrypoint-initdb.d)
-- Keeps local parity with production RDS parameter group extensions.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
