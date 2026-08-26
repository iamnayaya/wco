/**
 * Cross-service constants. Queue/exchange names are infrastructure contracts —
 * renaming any of these requires coordinated rollout (see docs/adr).
 */

export const SERVICE_NAMES = {
  BACKEND: 'wco-backend',
  AI_ENGINE: 'wco-ai-engine',
  WEBHOOK_HANDLER: 'wco-webhook-handler',
  FRONTEND: 'wco-frontend',
  MOBILE: 'wco-mobile',
} as const;

export const EXCHANGES = {
  DOMAIN_EVENTS: 'wco.domain-events', // topic exchange
  DEAD_LETTER: 'wco.dlx',
} as const;

export const ROUTING_KEYS = {
  MESSAGE_INBOUND: 'whatsapp.message.inbound',
  MESSAGE_OUTBOUND: 'whatsapp.message.outbound',
  ORDER_CREATED: 'order.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  SHIPMENT_BOOKED: 'shipment.booked',
  CONVERSATION_ESCALATED: 'conversation.escalated',
  CART_ABANDONED: 'cart.abandoned',
  ANALYTICS_EVENT: 'analytics.event',
} as const;

export const QUEUES = {
  WHATSAPP_INBOUND: 'q.whatsapp.inbound',
  AI_AUTO_RESPONDER: 'q.ai.auto-responder',
  AI_PRICING: 'q.ai.pricing',
  NOTIFICATIONS_DISPATCH: 'q.notifications.dispatch',
  CAMPAIGN_SENDER: 'q.campaign.sender',
  ANALYTICS_ROLLUP: 'q.analytics.rollup',
  OUTBOX_RELAY: 'q.outbox.relay',
  WEBHOOK_PROCESSOR: 'q.webhook.processor',
} as const;

export const CACHE_TTL = {
  STORE_SETTINGS_SECONDS: 300,
  PRODUCT_CATALOG_SECONDS: 60,
  DASHBOARD_STATS_SECONDS: 30,
  IDEMPOTENCY_SECONDS: 86_400,
  RATE_LIMIT_WINDOW_SECONDS: 60,
} as const;

export const RATE_LIMITS = {
  AUTH_PER_MINUTE: 10,
  API_DEFAULT_PER_MINUTE: 100,
  PUBLIC_WEBHOOK_PER_MINUTE: 600,
  AI_GENERATION_PER_MINUTE: 60,
} as const;

export const LIMITS = {
  MAX_PRODUCTS_PER_STORE_FREE: 50,
  MAX_STORES_PER_MERCHANT_FREE: 1,
  MAX_MESSAGE_LENGTH: 4096,
  MAX_ORDER_ITEMS: 100,
  PAGE_SIZE_DEFAULT: 25,
  PAGE_SIZE_MAX: 100,
} as const;

/** Order status state machine — legal transitions only. */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'REFUNDED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const WA_MESSAGE_LIMIT_CHARS = 4096;
export const SUPPORTED_COUNTRIES = ['NG', 'GH', 'KE'] as const;
