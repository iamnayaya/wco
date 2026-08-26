import { LIMITS, RATE_LIMITS, CACHE_TTL } from '@wco/shared';

/**
 * Backend-specific constants. Cross-service contracts (queue names, routing
 * keys) live in @wco/shared — never duplicate them here.
 */

export const SERVICE_NAME = 'wco-backend';

/** Public API keys look like `wco_<base64url>` — see utils/crypto.ts. */
export const API_TOKEN_PREFIX = 'wco_';

export const API_PREFIX = '/api';
export const API_VERSION = 'v1';
export const API_BASE_PATH = `${API_PREFIX}/${API_VERSION}`;

export const REDIS_PREFIX = {
  RATE_LIMIT: 'wco:rl:',
  CACHE: 'wco:cache:',
  IDEMPOTENCY: 'wco:idem:',
  SESSION: 'wco:sess:',
} as const;

export const HTTP_TIMEOUTS_MS = {
  REQUEST_BODY: 10_000,
  GRACEFUL_SHUTDOWN: 30_000,
  OUTBOUND_HTTP: 15_000,
} as const;

/** Upload guardrails — enforced by multer before S3 upload. */
export const UPLOAD_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_FILES_PER_REQUEST: 5,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
} as const;

/** Cache key templates (values interpolated at call sites). */
export const CACHE_KEYS = {
  PRODUCT_CATALOG: (storeId: string, pageHash: string) => `catalog:${storeId}:${pageHash}`,
  DASHBOARD_STATS: (storeId: string, day: string) => `dash:${storeId}:${day}`,
  STORE_SETTINGS: (storeId: string) => `store:${storeId}:settings`,
  CUSTOMER_PROFILE: (storeId: string, phone: string) => `cust:${storeId}:${phone}`,
} as const;

// Re-export the shared knobs under stable names for this service.
export const PAGE_SIZE_DEFAULT = LIMITS.PAGE_SIZE_DEFAULT;
export const PAGE_SIZE_MAX = LIMITS.PAGE_SIZE_MAX;
export { RATE_LIMITS, CACHE_TTL };
