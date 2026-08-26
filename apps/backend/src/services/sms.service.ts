import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * SMS service — Twilio REST via fetch (zero SDK dependency).
 *
 * SMS is the FALLBACK channel: WhatsApp is primary, but when a customer has
 * no WhatsApp or delivery fails, order updates still must land. Called only
 * from workers; request paths enqueue instead of sending inline.
 */

export interface SmsSendResult {
  readonly ok: boolean;
  readonly providerSid?: string;
  readonly error?: string;
}

const TWILIO_API = 'https://api.twilio.com/2010-04-01';

export async function sendSms(toPhone: string, body: string): Promise<SmsSendResult> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    logger.warn('sms.not-configured');
    return { ok: false, error: 'SMS provider not configured' };
  }
  if (body.length > 1600) body = `${body.slice(0, 1590)}…`;

  try {
    const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: toPhone, From: from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.error('sms.send-failed', { status: res.status, detail: detail.slice(0, 300) });
      return { ok: false, error: `twilio ${res.status}` };
    }
    const json = (await res.json()) as { sid?: string };
    return { ok: true, providerSid: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function renderSmsTemplate(template: 'order-paid' | 'delivery-update', data: Record<string, string | number>): string {
  switch (template) {
    case 'order-paid':
      return `Your order ${data.orderNumber} is confirmed! Total ${data.amount}. We'll update you when it ships.`;
    case 'delivery-update':
      return `Order ${data.orderNumber}: your package is now ${data.status}. Track: ${data.trackingCode}`;
  }
}
