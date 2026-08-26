import type { Currency, Order, OrderStatus } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';

/**
 * WhatsApp order messaging - status updates that reach buyers where the
 * conversation already lives. The transport is a seam (`push`): today it
 * logs; the WhatsApp Cloud API client plugs in without touching call sites.
 * Set WHATSAPP_ORDER_PUSH=fail in tests to simulate provider errors.
 */

export type OrderEventType = 'created' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

const HEADLINES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'is awaiting payment',
  PAID: 'payment confirmed - thank you!',
  PROCESSING: 'is being prepared',
  SHIPPED: 'is on the way',
  DELIVERED: 'has been delivered',
  CANCELLED: 'was cancelled',
  REFUNDED: 'has been refunded',
};

export interface OrderMessageContext {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly total: string;
  readonly currency: Currency;
  readonly customerName: string;
}

/** Human copy for a buyer notification. Pure + unit-tested. */
export function buildOrderStatusMessage(ctx: OrderMessageContext): string {
  const headline = HEADLINES[ctx.status];
  const tracking =
    ctx.status === 'SHIPPED'
      ? ' You will receive tracking details shortly.'
      : '';
  return `Hi ${ctx.customerName}, order ${ctx.orderNumber} ${headline}.${tracking} Total: ${ctx.currency} ${ctx.total}. Reply here if anything looks wrong.`;
}

export interface WaSyncEntry {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly waPhone: string;
  readonly message: string;
}

export class WhatsAppOrderSyncService {
  /**
   * Queues status-update messages for every open order with a WhatsApp
   * number. Terminal states (delivered/cancelled/refunded) never re-notify.
   */
  async syncStore(storeId: string): Promise<{ queued: number; skippedNoWhatsApp: number; failed: number }> {
    const orders = await prisma.order.findMany({
      where: { storeId, status: { notIn: ['DELIVERED', 'CANCELLED', 'REFUNDED'] as OrderStatus[] } },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    let queued = 0;
    let skippedNoWhatsApp = 0;
    let failed = 0;

    for (const order of orders) {
      const customer = await this.loadCustomer(order.customerId);
      if (!customer || customer.waPhone === null) {
        skippedNoWhatsApp += 1;
        continue;
      }
      const phone: string = customer.waPhone;
      const entry: WaSyncEntry = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        waPhone: phone,
        message: buildOrderStatusMessage(this.toContext(order, customer.name)),
      };
      try {
        await this.push(entry);
        queued += 1;
      } catch {
        failed += 1;
      }
    }
    return { queued, skippedNoWhatsApp, failed };
  }

  /** Transport seam - swap for the Cloud API client in production wiring. */
  async push(entry: WaSyncEntry): Promise<void> {
    if (process.env.WHATSAPP_ORDER_PUSH === 'fail') {
      throw new Error('WHATSAPP_ORDER_PUSH=fail simulated provider error');
    }
    // Default no-op transport keeps tests hermetic and local dev quiet.
    void entry;
  }

  private async loadCustomer(customerId: string): Promise<{ name: string; waPhone: string | null } | null> {
    const rows = await prisma.customer.findMany({ where: { id: customerId }, take: 1 });
    const row = rows.at(0);
    return row ? { name: row.name ?? 'Customer', waPhone: row.waPhone } : null;
  }

  private toContext(order: Order, customerName: string): OrderMessageContext {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: String(order.total),
      currency: order.currency,
      customerName,
    };
  }
}

export const whatsAppOrderSyncService = new WhatsAppOrderSyncService();
