/**
 * Domain event catalog — the contract between producers (backend, webhook
 * handler) and consumers (ai-engine, notifications, analytics workers).
 * Events are published via the transactional outbox → RabbitMQ topic exchange.
 */

import type { OrderStatus } from '../types';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly id: string;
  readonly type: EventType;
  readonly aggregateType: 'order' | 'payment' | 'shipment' | 'conversation' | 'customer' | 'store';
  readonly aggregateId: string;
  readonly storeId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export const EVENT_TYPES = [
  // Messaging
  'message.received',
  'message.sent',
  'conversation.escalated',
  'conversation.resolved',
  // Orders
  'order.created',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  // Payments
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  // Commerce signals
  'cart.abandoned',
  'customer.created',
  'customer.returned',
  // AI
  'ai.reply.generated',
  'ai.handoff.suggested',
  'ai.price.suggested',
  // Logistics
  'shipment.quoted',
  'shipment.booked',
  'shipment.delivered',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface OrderPaidPayload {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  customerId: string;
  customerWaPhone: string;
  status: OrderStatus;
}

export interface InboundMessagePayload {
  conversationId: string;
  messageId: string;
  waMessageId: string;
  storeId: string;
  fromPhone: string;
  body: string;
  type: string;
}

export interface CartAbandonedPayload {
  customerId: string;
  storeId: string;
  cartValue: number;
  itemCount: number;
  minutesIdle: number;
}

/** Routing key convention: <aggregate>.<event> e.g. order.paid. */
export function routingKeyFor(eventType: EventType): string {
  return eventType;
}
