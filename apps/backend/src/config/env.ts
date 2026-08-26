import { z } from 'zod';

/**
 * Environment configuration — validated ONCE at boot with Zod.
 *
 * Contract: the process refuses to start on invalid or missing required
 * configuration ("crash fast at boot, never limp at 3am"). Every consumer
 * imports the typed `env` object instead of touching process.env directly,
 * which keeps a single source of truth and makes the full runtime surface
 * greppable.
 */

const booleanish = z
  .string()
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));

const csv = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const envSchema = z.object({
  // --- Runtime ---------------------------------------------------------------
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  TRUST_PROXY: booleanish.default('false'),
  HTTPS_KEY_PATH: z.string().optional(),
  HTTPS_CERT_PATH: z.string().optional(),

  // --- Observability ----------------------------------------------------------
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  SENTRY_DSN: z.string().url().optional(),
  METRICS_ENABLED: booleanish.default('true'),

  // --- Docs & platform ops -----------------------------------------------------
  OPENAPI_SPEC_PATH: z.string().optional(),
  ADMIN_API_KEY: z.string().min(16).optional(),

  // --- CORS -------------------------------------------------------------------
  CORS_ORIGIN: csv.default('http://localhost:3000'),

  // --- Data stores --------------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(20),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().min(1).default('amqp://localhost:5672'),

  // --- Auth -----------------------------------------------------------------------
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('wco'),
  JWT_AUDIENCE: z.string().default('wco-api'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  /** AES-256-GCM key (base64, 32 bytes) encrypting TOTP secrets at rest. */
  AUTH_SECRET: z
    .string()
    .min(44, 'AUTH_SECRET must be >= 44 chars (32-byte base64)')
    .default('YXV0aHNlY3JldGRlZmF1bHRkZXZvbmx5MzJieXRlcyE='), // dev/test only - set in prod
  /** Login is blocked until the email is verified when true. */
  REQUIRE_VERIFIED_LOGIN: booleanish.default('false'),
  ACCOUNT_LOCKOUT_THRESHOLD: z.coerce.number().int().min(1).default(5),
  ACCOUNT_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),

  // --- OAuth (optional - endpoints return 503 until configured) ---------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  OAUTH_REDIRECT_BASE_URL: z.string().url().optional(),

  // --- Rate limiting -----------------------------------------------------------------
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // --- Jobs ------------------------------------------------------------------------------
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(10),

  // --- Integrations (all optional — features degrade gracefully) ----------------------------
  META_WHATSAPP_NUMBER_ID: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().default('wco-verify-dev'),
  WEBHOOK_INGRESS_KEY: z.string().min(8).optional(),
  AI_PROCESSING_MODE: z.enum(['queue', 'inline']).default('queue'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  GIG_API_KEY: z.string().optional(),
  KWIK_API_KEY: z.string().optional(),
  SENDY_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@wco.test'),
  SMTP_SECURE: booleanish.default('false'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('wco-uploads-dev'),
  AWS_S3_CDN_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parse-or-die. Exported for tests. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env: Env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
