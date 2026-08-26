import type { OutboundMessage, SendResult, WhatsAppProvider } from '../whatsapp-provider.interface';

const GRAPH_BASE = process.env.META_GRAPH_URL ?? 'https://graph.facebook.com/v20.0';

/**
 * MetaWhatsAppProvider — WhatsApp Business Cloud API (direct from Meta).
 * Preferred provider: no per-message markup, native interactive messages.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'META' as const;

  constructor(private readonly accessToken: string) {}

  async sendMessage(phoneNumberId: string, message: OutboundMessage): Promise<SendResult> {
    const payload = this.buildPayload(message);
    const response = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { providerMessageId: '', status: 'FAILED', errorReason: `Meta API ${response.status}: ${errText.slice(0, 300)}` };
    }

    const json = (await response.json()) as { messages?: Array<{ id: string }> };
    return {
      providerMessageId: json.messages?.[0]?.id ?? '',
      status: 'SENT',
    };
  }

  private buildPayload(message: OutboundMessage): Record<string, unknown> {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: message.to };

    if (message.templateName) {
      return {
        ...base,
        type: 'template',
        template: {
          name: message.templateName,
          language: { code: process.env.META_DEFAULT_TEMPLATE_LANGUAGE ?? 'en' },
          components: message.templateParams
            ? [{ type: 'body', parameters: message.templateParams.map((text) => ({ type: 'text', text })) }]
            : undefined,
        },
      };
    }

    if (message.mediaUrl && message.type && ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'].includes(message.type)) {
      const type = message.type.toLowerCase();
      return {
        ...base,
        type,
        [type]: { link: message.mediaUrl, ...(message.body ? { caption: message.body.slice(0, 1024) } : {}) },
      };
    }

    return {
      ...base,
      type: 'text',
      text: { preview_url: true, body: (message.body ?? '').slice(0, 4096) },
    };
  }
}
