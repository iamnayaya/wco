import { z } from 'zod';

/**
 * Environment schemas — one per service, composed from shared fragments.
 * Services call `loadEnv(ServiceEnv)` at boot: invalid config = no boot.
 */

const url = z.string().url();
const nonEmpty = z.string().min(1);
const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');

// --- Shared fragments -------------------------------------------------------

const coreDb = z.object({
  NODE_ENV: nodeEnv,
  DATABASE_URL: nonEmpty,
  REDIS_URL: nonEmpty,
});

const rabbit = z.object({
  RABBITMQ_URL: nonEmpty,
});

const jwt = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be >= 32 chars'),
  JWT_ISSUER: z.string().default('wco'),
  JWT_AUDIENCE: z.string().default('wco-api'),
});

const whatsapp = z.object({
  WHATSAPP_PROVIDER: z.enum(['meta', 'twilio']).default('meta'),
  META_APP_ID: optionalUrl.or(z.string()),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
});

const ai = z.object({
  CLAUDE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const observability = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: optionalUrl,
});

// --- Service schemas --------------------------------------------------------

export const BackendEnv = coreDb.merge(rabbit).merge(jwt).merge(whatsapp).merge(ai).merge(observability);
export type BackendEnvType = z.infer<typeof BackendEnv>;

export const AiEngineEnv = coreDb.merge(rabbit).merge(ai).merge(observability);
export type AiEngineEnvType = z.infer<typeof AiEngineEnv>;

export const WebhookHandlerEnv = z
  .object({
    NODE_ENV: nodeEnv,
    PORT: z.coerce.number().int().positive().default(4100),
    REDIS_URL: nonEmpty,
    RABBITMQ_URL: nonEmpty,
  })
  .merge(whatsapp)
  .merge(
    z.object({
      PAYSTACK_SECRET_KEY: z.string().optional(),
      FLUTTERWAVE_SECRET_KEY: z.string().optional(),
      FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
      OPAY_PRIVATE_KEY: z.string().optional(),
      CARRIER_WEBHOOK_TOKEN: z.string().optional(),
      EMAIL_WEBHOOK_TOKEN: z.string().optional(),
    }),
  )
  .merge(observability);
export type WebhookHandlerEnvType = z.infer<typeof WebhookHandlerEnv>;

/**
 * Parse + freeze env. Throws a single aggregated error listing every problem —
 * a boot crash log you can fix in one pass.
 */
export function loadEnv<T extends z.ZodTypeAny>(schema: T, source: Record<string, unknown> = process.env): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(result.data);
}

/** Feature flags — env-driven for now; DB-backed per-merchant flags come later. */
export function featureFlags(env: Record<string, string | undefined> = process.env) {
  return {
    aiAutoResponder: env.FEATURE_AI_AUTO_RESPONDER === 'true',
    aiSentimentAnalysis: env.FEATURE_AI_SENTIMENT_ANALYSIS === 'true',
    aiDemandForecasting: env.FEATURE_AI_DEMAND_FORECASTING === 'true',
    aiCustomerSegmentation: env.FEATURE_AI_CUSTOMER_SEGMENTATION === 'true',
    broadcastCampaigns: env.FEATURE_BROADCAST_CAMPAIGNS === 'true',
    priceSuggestions: env.FEATURE_PRICE_SUGGESTIONS === 'true',
  };
}
