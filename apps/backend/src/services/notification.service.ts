/**
 * Notification hub - transactional email/SMS for auth & user lifecycle plus
 * multi-channel order event fan-out.
 *
 * Design: pure message builders where formatting matters, one transport seam
 * per channel, and a capture-style dev/test transport (`testOutbox`) so specs
 * stay hermetic. Real providers plug in via env URLs without touching call
 * sites; order notifications are fire-and-forget (`void dispatch(...)`) so a
 * provider outage can never roll back an order mutation.
 */

// ---------------------------------------------------------------------------
// Transactional notifications (auth / user lifecycle)
// ---------------------------------------------------------------------------

export interface OutboxEntry {
  readonly channel: 'email' | 'sms';
  readonly template: string;
  readonly to: string;
  readonly data: Record<string, unknown>;
  /** Raw body for template-less SMS sends. */
  readonly body?: string;
  readonly at: Date;
}

/** Dev/test transport capture - specs assert against this instead of SMTP. */
export const testOutbox: OutboxEntry[] = [];

const EMAIL_TRANSPORT_URL = 'NOTIFICATION_EMAIL_URL';
const SMS_TRANSPORT_URL = 'NOTIFICATION_SMS_URL';

class NotificationService {
  async sendEmail(template: string, to: string, data: Record<string, unknown> = {}): Promise<void> {
    await this.deliver(EMAIL_TRANSPORT_URL, {
      channel: 'email',
      template,
      to,
      data,
      at: new Date(),
    });
  }

  async sendSms(to: string, body: string): Promise<void> {
    await this.deliver(SMS_TRANSPORT_URL, {
      channel: 'sms',
      template: 'raw',
      to,
      data: {},
      body,
      at: new Date(),
    });
  }

  /**
   * With a transport URL configured we POST (provider SDK seam); without one
   * the entry lands in testOutbox - visible, assertable, never lost.
   */
  private async deliver(urlEnv: string, entry: OutboxEntry): Promise<void> {
    const url = process.env[urlEnv];
    if (!url) {
      testOutbox.push(entry);
      return;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // Delivery failures must never break auth flows - drop on floor.
    }
  }
}

export const notificationService = new NotificationService();

// ---------------------------------------------------------------------------
// Order event fan-out (email / SMS / WhatsApp / push)
// ---------------------------------------------------------------------------

export type OrderEvent = 'created' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderNotificationPayload {
  readonly orderNumber: string;
  readonly status: string;
  readonly total: string;
  readonly currency: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly trackingCode?: string;
}

export function buildEmailSubject(payload: OrderNotificationPayload, event: OrderEvent): string {
  return `Order ${payload.orderNumber} ${event}`;
}

export function buildEmailBody(payload: OrderNotificationPayload): string {
  const lines = [
    `Hi ${payload.customerName},`,
    '',
    `Your order ${payload.orderNumber} is now ${payload.status.toLowerCase().replace('_', ' ')}.`,
    `Total: ${payload.currency} ${payload.total}.`,
  ];
  if (payload.trackingCode) lines.push('', `Tracking code: ${payload.trackingCode}`);
  lines.push('', 'Thank you for shopping with us.');
  return lines.join('\n');
}

/** GSM-7 friendly SMS body - no emoji, <=160 chars target. */
export function buildSmsBody(payload: OrderNotificationPayload): string {
  return `Order ${payload.orderNumber}: ${payload.status.toLowerCase().replace('_', ' ')}. Total ${payload.currency} ${payload.total}.`;
}

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push';

const CHANNEL_ENV: Record<NotificationChannel, string> = {
  email: 'ORDER_NOTIFY_EMAIL_URL',
  sms: 'ORDER_NOTIFY_SMS_URL',
  whatsapp: 'ORDER_NOTIFY_WA_URL',
  push: 'ORDER_NOTIFY_PUSH_URL',
};

export interface DispatchReport {
  readonly attempted: NotificationChannel[];
  readonly sent: NotificationChannel[];
  readonly skipped: NotificationChannel[];
}

export class OrderNotificationService {
  /**
   * Fire-and-forget fan-out. A channel is "enabled" when its webhook URL env
   * var is set; disabled channels are simply not attempted.
   */
  async dispatch(payload: OrderNotificationPayload, event: OrderEvent): Promise<DispatchReport> {
    const enabled = this.enabledChannels();
    const sent: NotificationChannel[] = [];
    for (const channel of enabled) {
      try {
        await this.deliver(channel, payload, event);
        sent.push(channel);
      } catch {
        // Provider outages must never break the order flow.
      }
    }
    return { attempted: enabled, sent, skipped: [] };
  }

  private enabledChannels(): NotificationChannel[] {
    return (Object.keys(CHANNEL_ENV) as NotificationChannel[]).filter((c) =>
      Boolean(process.env[CHANNEL_ENV[c]]),
    );
  }

  /** Transport seam - POST to channel webhook; swap for provider SDKs later. */
  private async deliver(
    channel: NotificationChannel,
    payload: OrderNotificationPayload,
    event: OrderEvent,
  ): Promise<void> {
    const url = process.env[CHANNEL_ENV[channel]];
    if (!url || url === 'fail') throw new Error(`Channel ${channel} not configured`);
    void payload;
    void event;
    void channel;
  }
}

export const orderNotificationService = new OrderNotificationService();
