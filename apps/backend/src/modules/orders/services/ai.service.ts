import type { Customer, Order } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/**
 * Order intelligence - heuristic engines that run synchronously and cost
 * nothing (the LLM upgrade path swaps the internals, not the contracts).
 *
 *  1. Fulfillment prediction - minutes-to-doorstep estimate from order shape
 *     (line count, units, delivery mode, distance signal).
 *  2. Fraud detection - additive risk scoring; >=70 flags the order HIGH for
 *     merchant review. Pure functions are unit-tested; the class only loads
 *     context and persists the score.
 */

export interface FulfillmentBasis {
  readonly label: string;
  readonly minutes: number;
}

export interface FulfillmentPrediction {
  readonly predictedMinutes: number;
  readonly confidence: number;
  readonly basis: readonly FulfillmentBasis[];
}

export interface FulfillmentInput {
  readonly lineCount: number;
  readonly totalQty: number;
  readonly hasDeliveryAddress: boolean;
  readonly city?: string | null;
  readonly storeCity?: string | null;
  readonly channel: string;
}

const BASE_MINUTES = 45;

/** Pure estimator - every contribution is visible to merchants and tests. */
export function predictFulfillment(input: FulfillmentInput): FulfillmentPrediction {
  const basis: FulfillmentBasis[] = [{ label: 'Base handling', minutes: BASE_MINUTES }];

  if (input.lineCount > 1) {
    basis.push({ label: `${input.lineCount} distinct products`, minutes: (input.lineCount - 1) * 6 });
  }
  const bulkUnits = Math.max(0, input.totalQty - 5);
  if (bulkUnits > 0) {
    basis.push({ label: `${input.totalQty} total units`, minutes: Math.ceil(bulkUnits / 5) * 8 });
  }
  basis.push(
    input.hasDeliveryAddress
      ? { label: 'Courier delivery', minutes: 30 }
      : { label: 'Pickup / hand delivery', minutes: 10 },
  );
  const crossCity =
    input.city !== undefined &&
    input.city !== null &&
    input.city.trim() !== '' &&
    input.storeCity !== null &&
    input.storeCity !== undefined &&
    !cityEquals(input.city, input.storeCity);
  if (crossCity) basis.push({ label: 'Intercity dispatch', minutes: 45 });
  if (input.channel === 'WHATSAPP') basis.push({ label: 'WhatsApp fast-confirm', minutes: -5 });

  const predictedMinutes = Math.max(10, basis.reduce((sum, b) => sum + b.minutes, 0));
  const confidence = Math.max(0.5, 0.85 - (basis.length - 1) * 0.04);
  return { predictedMinutes, confidence, basis };
}

function cityEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Fraud scoring
// ---------------------------------------------------------------------------

export type FraudLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FraudSignal {
  readonly code: string;
  readonly detail: string;
  readonly weight: number;
}

export interface FraudVerdict {
  readonly riskScore: number;
  readonly level: FraudLevel;
  readonly signals: readonly FraudSignal[];
}

export interface FraudInput {
  readonly total: number;
  readonly avgOrderValue: number;
  readonly customerOrdersCount: number;
  readonly customerAgeDays: number;
  readonly maxLineQty: number;
  readonly hasDeliveryAddress: boolean;
}

/** Value-shaped rules share the "unusual amount" notion. */
function pushValueSignals(signals: FraudSignal[], input: FraudInput): void {
  if (input.avgOrderValue > 0 && input.total > input.avgOrderValue * 3) {
    signals.push({
      code: 'HIGH_VALUE',
      detail: `Total is ${(input.total / input.avgOrderValue).toFixed(1)}x the store average`,
      weight: 35,
    });
  }
  if (input.customerAgeDays < 1 && input.customerOrdersCount <= 1 && input.total > Math.max(input.avgOrderValue, 20_000)) {
    signals.push({
      code: 'NEW_CUSTOMER_HIGH_VALUE',
      detail: 'First order from this buyer within 24h at an unusual amount',
      weight: 25,
    });
  }
}

/** Pure additive scorer - clamped to 0..100. */
export function scoreOrderFraud(input: FraudInput): FraudVerdict {
  const signals: FraudSignal[] = [];
  pushValueSignals(signals, input);

  if (input.maxLineQty >= 10) {
    signals.push({
      code: 'BULK_QUANTITY',
      detail: `${input.maxLineQty} units of a single product`,
      weight: 15,
    });
  }
  if (!input.hasDeliveryAddress && input.total > Math.max(input.avgOrderValue, 20_000)) {
    signals.push({
      code: 'NO_ADDRESS',
      detail: 'High-value order without a delivery address',
      weight: 10,
    });
  }
  if (input.total > 50_000 && input.total % 1_000 === 0) {
    signals.push({ code: 'ROUND_AMOUNT', detail: 'Large perfectly-round total', weight: 10 });
  }

  const riskScore = clamp(signals.reduce((sum, s) => sum + s.weight, 0));
  const level: FraudLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
  return { riskScore, level, signals };
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Service wrappers
// ---------------------------------------------------------------------------

export class OrderAiService {
  /** Estimates fulfillment for a live order; nothing is persisted. */
  async predictFulfillment(storeId: string, orderId: string): Promise<FulfillmentPrediction & { orderId: string }> {
    const order = await this.requireOrderWithItems(storeId, orderId);
    const storeRows = await prisma.store.findMany({ where: { id: storeId }, take: 1 });
    const store = storeRows.at(0);
    return {
      orderId,
      ...predictFulfillment({
        lineCount: order.items.length,
        totalQty: order.items.reduce((sum, i) => sum + i.quantity, 0),
        hasDeliveryAddress: Boolean(order.deliveryAddress),
        city: order.deliveryCity,
        storeCity: store?.city ?? null,
        channel: order.channel,
      }),
    };
  }

  /**
   * Scores an order for fraud and persists the score on the row so lists can
   * surface flagged orders. Returns the verdict plus the review flag.
   */
  async checkFraud(
    storeId: string,
    orderId: string,
  ): Promise<FraudVerdict & { orderId: string; flaggedForReview: boolean }> {
    const order = await this.requireOrderWithItems(storeId, orderId);
    const [customer, avg] = await Promise.all([
      this.loadCustomer(order),
      this.storeAverageValue(storeId),
    ]);
    const verdict = scoreOrderFraud({
      total: Number(order.total),
      avgOrderValue: avg,
      customerOrdersCount: customer?.ordersCount ?? 0,
      customerAgeDays: customer ? ageInDays(customer.createdAt) : 0,
      maxLineQty: order.items.reduce((max, i) => Math.max(max, i.quantity), 0),
      hasDeliveryAddress: Boolean(order.deliveryAddress),
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { fraudScore: verdict.riskScore },
    });
    return { orderId: order.id, ...verdict, flaggedForReview: verdict.level === 'HIGH' };
  }

  private async requireOrderWithItems(storeId: string, orderId: string): Promise<Order & { items: Array<{ quantity: number }> }> {
    const rows = await prisma.order.findMany({ where: { id: orderId, storeId }, take: 1 });
    const order = rows.at(0);
    if (!order) throw new NotFoundError('Order');
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    return { ...order, items };
  }

  private async loadCustomer(order: Order): Promise<{ createdAt: Date; ordersCount: number } | null> {
    const rows = await prisma.customer.findMany({ where: { id: order.customerId }, take: 1 });
    const customer = rows.at(0) as (Customer & { ordersCount?: number }) | undefined;
    if (!customer) return null;
    const siblings = await prisma.order.findMany({ where: { customerId: customer.id } });
    return { createdAt: customer.createdAt, ordersCount: siblings.length };
  }

  private async storeAverageValue(storeId: string): Promise<number> {
    const orders = await prisma.order.findMany({ where: { storeId } });
    if (orders.length === 0) return 0;
    const sum = orders.reduce((acc, o) => acc + Number(o.total), 0);
    return sum / orders.length;
  }
}

function ageInDays(from: Date): number {
  return (Date.now() - from.getTime()) / 86_400_000;
}

export const orderAiService = new OrderAiService();
