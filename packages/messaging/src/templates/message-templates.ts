/**
 * Message templates for outbound automation.
 * Placeholders: {{customerName}}, {{orderNumber}}, {{total}}, {{itemCount}},
 * {{storeName}}, {{trackingCode}}. Rendered with renderTemplate().
 */

export interface TemplateContext {
  customerName?: string;
  orderNumber?: string;
  total?: string;
  itemCount?: number;
  storeName?: string;
  trackingCode?: string;
  paymentLink?: string;
  productName?: string;
}

export const TEMPLATES = {
  ORDER_CONFIRMATION:
    '✅ Order {{orderNumber}} confirmed!\n\n' +
    '{{itemCount}} item(s) — {{total}}\nPay here to lock it in: {{paymentLink}}\n\n' +
    '— {{storeName}}',

  PAYMENT_RECEIVED:
    '🎉 Payment received! {{total}} for order {{orderNumber}}.\n' +
    'We are packing your items now. You will get a delivery update shortly.\n\n' +
    '— {{storeName}}',

  SHIPMENT_UPDATE:
    '📦 Good news! Your order {{orderNumber}} is on the way.\n' +
    'Track it here: {{trackingCode}}\n\nThank you for shopping with {{storeName}}!',

  ABANDONED_CART:
    'Hi {{customerName}} 👋\n' +
    'You left {{itemCount}} item(s) in your cart at {{storeName}}. ' +
    'Want me to reserve them? Stock moves fast! 😊',

  FOLLOW_UP_REVIEW:
    'Hi {{customerName}}, how was your order from {{storeName}}? ' +
    'Your feedback helps other customers. Reply 1-5 to rate us ⭐',

  PRICE_INQUIRY_ACK:
    'Hello! 👋 Thanks for reaching out to {{storeName}}. ' +
    'Let me check that price for you right away…',
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/{{(\w+)}}/g, (match, key: string) => {
    const value = context[key as keyof TemplateContext];
    if (value === undefined || value === null) return match;
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  });
}

/** Truncate to WhatsApp hard limit, preserving trailing punctuation. */
export function fitWhatsAppLimit(body: string): string {
  if (body.length <= 4096) return body;
  return `${body.slice(0, 4090)}…`;
}
