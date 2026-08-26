/**
 * Typed application configuration.
 *
 * Values come from validated environment (see app.module validateEnv).
 * Never read process.env directly in feature code — import this factory
 * via ConfigService<Configuration>.
 */
export interface Configuration {
  readonly app: {
    readonly name: string;
    readonly env: 'development' | 'staging' | 'production' | 'test';
    readonly port: number;
    readonly corsOrigins: string[];
  };
  readonly database: {
    readonly url: string;
    readonly ssl: boolean;
    readonly poolSize: number;
  };
  readonly redis: {
    readonly url: string;
  };
  readonly rabbitmq: {
    readonly url: string;
  };
  readonly jwt: {
    readonly secret: string;
    readonly expiresIn: string;
    readonly refreshSecret: string;
    readonly issuer: string;
  };
  readonly ai: {
    readonly claudeApiKey?: string;
    readonly openAiApiKey?: string;
    readonly autoResponderEnabled: boolean;
  };
}

export default (): Configuration => ({
  app: {
    name: process.env.APP_NAME ?? 'WhatsApp Commerce OS',
    env: (process.env.NODE_ENV as Configuration['app']['env']) ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  },
  database: {
    url: process.env.DATABASE_URL as string,
    ssl: process.env.DATABASE_SSL === 'true',
    poolSize: Number(process.env.DATABASE_POOL_SIZE ?? 20),
  },
  redis: {
    url: process.env.REDIS_URL as string,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? `${process.env.JWT_SECRET}-refresh`,
    issuer: process.env.JWT_ISSUER ?? 'wco',
  },
  ai: {
    claudeApiKey: process.env.CLAUDE_API_KEY,
    openAiApiKey: process.env.OPENAI_API_KEY,
    autoResponderEnabled: process.env.FEATURE_AI_AUTO_RESPONDER !== 'false',
  },
});
