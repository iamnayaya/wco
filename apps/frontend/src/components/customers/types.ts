import type { PaginationMeta } from '../../lib/api/client';

/**
 * Customer directory wire models — WhatsApp-first CRM records.
 * `waPhone` is the identity key; money arrives as decimal strings
 * (e.g. `totalSpent: "14700"`) — convert with `toNumber` before formatting.
 */

export interface Customer {
  id: string;
  storeId: string;
  waPhone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  segment: string | null;
  marketingOptIn: boolean;
  totalSpent: string;
  ordersCount: number;
  lastSeenAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SORTABLE_FIELD = 'createdAt' | 'name' | 'totalSpent' | 'ordersCount' | 'lastOrderAt';

export interface ListCustomersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  tag?: string;
  segment?: string;
  marketingOptIn?: boolean;
  minSpent?: number;
  maxSpent?: number;
  sortBy?: SORTABLE_FIELD;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomersListResult {
  items: Customer[];
  meta: PaginationMeta;
}

export interface CustomerStats {
  customerId: string;
  totalSpent: number;
  ordersCount: number;
  avgOrderValue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  lastSeenAt: string | null;
  marketingOptIn: boolean;
  tags: string[];
  segment: string | null;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  authorId: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTag {
  id: string;
  storeId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentRule {
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minOrders?: number;
  maxOrders?: number;
  idleDaysMin?: number;
  idleDaysMax?: number;
  newWithinDays?: number;
  marketingOptIn?: boolean;
}

export interface CustomerSegment {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  rule: SegmentRule;
  isSystem: boolean;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoSegmentResult {
  computedAt: string;
  perSegment: Array<{ segmentId: string; name: string; members: number; added: number; removed: number }>;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: string | number;
  currency: string;
  createdAt: string;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  direction: string;
  body: string;
  status?: string;
  createdAt: string;
}

export interface ImportResult {
  created: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; error: string }>;
  totalRows: number;
}
