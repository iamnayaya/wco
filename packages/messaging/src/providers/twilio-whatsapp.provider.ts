import type { OutboundMessage, SendResult, WhatsAppProvider } from '../whatsapp-provider.interface';

/**
 * TwilioWhatsAppProvider — Twilio WhatsApp Business API.
 * Fallback provider for regions where Meta direct onboarding is slow;
 * also useful during merchant migration (number porting windows).
 */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'TWILIO' as const;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
  ) {}

  async sendMessage(_phoneNumberId: string, message: OutboundMessage): Promise<SendResult> {
    const from = process.env.TWILIO_WHATSAPP_NUMBER ?? '';
    if (!from) return { providerMessageId: '', status: 'FAILED', errorReason: 'TWILIO_WHATSAPP_NUMBER not configured' };

    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${message.to}`,
      Body: message.body ?? '',
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { providerMessageId: '', status: 'FAILED', errorReason: `Twilio ${response.status}: ${errText.slice(0, 300)}` };
    }

    const json = (await response.json()) as { sid?: string };
    return { providerMessageId: json.sid ?? '', status: 'SENT' };
  }
}
