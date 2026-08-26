/**
 * Jest global setup - runs BEFORE any test module is imported.
 *
 * src/config/env.ts parses process.env at import time and refuses to boot on
 * missing required values, so tests must provide a complete valid environment
 * up front. Values mirror .env.example with test-safe secrets.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // ephemeral port when servers are created
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/wco_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
process.env.JWT_SECRET = 'test-jwt-secret-value-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-value-at-least-32-chars!!';
process.env.LOG_LEVEL = 'error';
process.env.METRICS_ENABLED = 'false';
