export * from './whatsapp-provider.interface';
export { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
export { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
export * from './templates/message-templates';

import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import type { WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * Resolve the WhatsApp provider per store. Store.settings.provider selects
 * META (default) or TWILIO; credentials come from platform env for now and
 * move to encrypted merchant-provided tokens after self-serve onboarding.
 */
export function resolveProvider(storeSettings?: { provider?: string }): WhatsAppProvider {
  const preferred = storeSettings?.provider ?? process.env.WHATSAPP_PROVIDER ?? 'META';

  if (preferred === 'TWILIO' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return new TwilioWhatsAppProvider(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  if (!process.env.META_ACCESS_TOKEN) {
    throw new Error('No WhatsApp provider configured: set META_ACCESS_TOKEN or Twilio credentials');
  }
  return new MetaWhatsAppProvider(process.env.META_ACCESS_TOKEN);
}
