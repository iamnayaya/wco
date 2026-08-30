import type { Order } from '@/lib/api/client';

/**
 * WCO Frontend — shared test fixtures.
 * Centralised so unit, integration and E2E suites reference one source of
 * truth for realistic-shaped payloads.
 */

export const user = {
  id: 'usr_01',
  email: 'nkechi@wco.test',
  fullName: 'Nkechi Okafor',
  role: 'OWNER',
  merchant: { id: 'mch_01', companyName: 'Mama Nkechi Foods', plan: 'pro' },
};

export const session = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-123',
  expiresIn: 900,
  user,
};

export const orders: Order[] = [
  {
    id: 'ord_001',
    orderNumber: 'WCO-1001',
    status: 'PAID',
    subtotal: 12500,
    total: 12500,
    createdAt: '2025-01-02T10:00:00.000Z',
  },
  {
    id: 'ord_002',
    orderNumber: 'WCO-1002',
    status: 'PENDING_PAYMENT',
    subtotal: 4500,
    total: 4500,
    createdAt: '2025-01-03T12:30:00.000Z',
  },
  {
    id: 'ord_003',
    orderNumber: 'WCO-1003',
    status: 'DELIVERED',
    subtotal: 9800,
    total: 9800,
    createdAt: '2025-01-04T09:15:00.000Z',
  },
];

export const paginatedOrders = {
  items: orders,
  nextCursor: null,
};

export const customers = [
  {
    id: 'cus_001',
    name: 'Amina Bello',
    phone: '+2348012345678',
    email: 'amina@example.com',
    totalSpent: 120000,
    orderCount: 8,
    status: 'VIP',
    lastOrderAt: '2025-01-03T14:00:00.000Z',
  },
  {
    id: 'cus_002',
    name: 'Chidi Eze',
    phone: '+2348098765432',
    email: 'chidi@example.com',
    totalSpent: 15000,
    orderCount: 2,
    status: 'NEW',
    lastOrderAt: null,
  },
];

export const conversations = [
  {
    id: 'thr_001',
    customerName: 'Amina Bello',
    lastMessage: 'Is the ankara fabric still available?',
    lastMessageAt: '2025-01-04T08:00:00.000Z',
    unread: 2,
    status: 'auto',
  },
  {
    id: 'thr_002',
    customerName: 'Chidi Eze',
    lastMessage: 'Great, thanks!',
    lastMessageAt: '2025-01-03T16:00:00.000Z',
    unread: 0,
    status: 'live',
  },
];

export const dashboardStats = {
  revenue: { today: 320500, delta: 12.4 },
  orders: { today: 42, delta: -3.1 },
  customers: { total: 312, delta: 5.8 },
  avgOrderValue: { value: 7631, delta: 2.2 },
};

export const analyticsSummary = {
  totalRevenue: 12500000,
  totalOrders: 384,
  totalCustomers: 312,
  conversionRate: 4.6,
};

export const stores = [
  {
    id: 'mch_01',
    name: 'Mama Nkechi Foods',
    slug: 'mama-nkechi-foods',
    whatsappNumber: '+2348012345678',
    currency: 'NGN',
    status: 'active',
    _count: { products: 24, orders: 384, customers: 312 },
  },
];
