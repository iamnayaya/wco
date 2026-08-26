/**
 * Domain enums mirroring packages/database/prisma/schema.prisma.
 * Kept in sync manually â€” schema.prisma is the source of truth for storage;
 * these exist so frontend/mobile/ai-engine never depend on @prisma/client.
 */

export const USER_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'AGENT', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CHANNELS = ['WHATSAPP', 'DASHBOARD', 'PAYMENT_LINK'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_PROVIDERS = ['PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'BANK_TRANSFER', 'CASH'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  'INITIALIZED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'ABANDONED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const LOGISTICS_CARRIERS = ['GIG', 'KWIK', 'SENDY', 'MANUAL'] as const;
export type LogisticsCarrier = (typeof LOGISTICS_CARRIERS)[number];

export const SHIPMENT_STATUSES = [
  'QUOTED',
  'BOOKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const CONVERSATION_STATUSES = ['BOT', 'HANDLED', 'CLOSED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/** Mirrors Prisma enums MessageDirection/MessageType/MessageStatus. */
export const MESSAGE_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_TYPES = [
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'TEMPLATE',
  'INTERACTIVE',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const CAMPAIGN_TYPES = [
  'ABANDONED_CART',
  'FOLLOW_UP',
  'PROMOTION',
  'WINBACK',
  'REVIEW_REQUEST',
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type SentimentLabel = (typeof SENTIMENTS)[number];

// -----------------------------------------------------------------------------
// API contracts
// -----------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  merchantId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Money {
  amount: number;
  currency: Currency;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  currency: Currency;
  createdAt: string;
  customer: { id: string; name?: string | null; waPhone: string };
  itemCount: number;
}

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
  status: ProductStatus;
  imageUrl?: string | null;
}

export interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  newCustomersToday: number;
  conversationsOpen: number;
  aiResolutionRate: number;
  avgResponseSeconds: number;
}
