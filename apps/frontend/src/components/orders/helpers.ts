import { formatMoney } from '../../lib/utils/format';
import type { FraudLevel, OrderChannel, OrderStatus } from './types';
import { toNumber } from './types';

/** Human label for an order status code (used in buttons/labels, not badges). */
export function statusLabel(status: OrderStatus): string {
  return status.replaceAll('_', ' ');
}

export function channelLabel(channel: OrderChannel): string {
  switch (channel) {
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'PAYMENT_LINK':
      return 'Payment link';
    default:
      return 'Dashboard';
  }
}

/** Format a decimal string (e.g. "14700") as money in the order currency. */
export function formatOrderMoney(value: string | number | null | undefined, currency = 'NGN'): string {
  return formatMoney(toNumber(value), currency);
}

/** Valid next legal transitions for a given status (state machine). */
export function nextTransitions(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'PENDING_PAYMENT':
      return ['PAID', 'CANCELLED'];
    case 'PAID':
      return ['PROCESSING', 'CANCELLED'];
    case 'PROCESSING':
      return ['SHIPPED', 'CANCELLED'];
    case 'SHIPPED':
      return ['DELIVERED', 'CANCELLED'];
    case 'DELIVERED':
      return [];
    case 'CANCELLED':
    case 'REFUNDED':
      return [];
    default:
      return [];
  }
}

export const FRAUD_LEVEL_TONE: Record<FraudLevel, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  HIGH: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function fraudLevelLabel(level: FraudLevel): string {
  return { LOW: 'Low risk', MEDIUM: 'Medium risk', HIGH: 'High risk' }[level];
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
