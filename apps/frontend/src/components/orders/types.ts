import type { PaginationMeta } from '../../lib/api/client';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OrderChannel = 'WHATSAPP' | 'DASHBOARD' | 'PAYMENT_LINK';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export const ORDER_CHANNELS: OrderChannel[] = ['WHATSAPP', 'DASHBOARD', 'PAYMENT_LINK'];

export const STATUS_TRANSITIONS: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

/**
 * Wire model for an order row. Money fields arrive as decimal strings
 * (e.g. `total: "14700"`) — convert with `toNumber` before formatting.
 */
export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  channel: OrderChannel;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  currency: string;
  paymentReference: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  notes: string | null;
  fraudScore: number | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListItem extends Order {
  customer: { id: string; name: string | null; waPhone: string } | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  note: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface ListOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  channel?: OrderChannel;
  customerId?: string;
  q?: string;
  minTotal?: number;
  maxTotal?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrdersListResult {
  items: OrderListItem[];
  meta: PaginationMeta;
}

export interface OrderStats {
  total: number;
  byStatus: Record<OrderStatus, number>;
  revenue: number;
  avgOrderValue: number;
  todayCount: number;
  fulfilmentRate: number;
  cancelRate: number;
}

export interface FulfillmentBasis {
  label: string;
  minutes: number;
}

export interface FulfillmentPrediction {
  orderId: string;
  predictedMinutes: number;
  confidence: number;
  basis: FulfillmentBasis[];
}

export type FraudLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FraudSignal {
  code: string;
  detail: string;
  weight: number;
}

export interface FraudVerdict {
  orderId: string;
  riskScore: number;
  level: FraudLevel;
  signals: FraudSignal[];
  flaggedForReview: boolean;
}

export interface Refund {
  id: string;
  storeId: string;
  orderId: string;
  amount: string;
  reason: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  providerReference: string | null;
  processedAt: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface OrderNote {
  id: string;
  orderId: string;
  body: string;
  pinned: boolean;
  authorId: string | null;
  createdAt: string;
}

export type TimelineEventType = 'status' | 'note' | 'refund' | 'cancellation';

export interface TimelineEvent {
  type: TimelineEventType;
  at: string;
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  reason?: string | null;
  noteId?: string;
  body?: string;
  pinned?: boolean;
  refundId?: string;
  amount?: number;
  refundStatus?: string;
  cancellationId?: string;
}

export interface Timeline {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
  };
  itemCount: number;
  events: TimelineEvent[];
}

export interface ImportReport {
  created: number;
  failedRows: Array<{ row: number; error: string }>;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
