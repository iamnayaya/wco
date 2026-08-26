import type { MessageType, MessageStatus } from '@wco/shared';

export interface OutboundMessage {
  readonly to: string; // E.164
  readonly type?: Exclude<MessageType, 'INBOUND'>;
  readonly body?: string;
  readonly mediaUrl?: string;
  readonly templateName?: string;
  readonly templateParams?: string[];
}

export interface SendResult {
  readonly providerMessageId: string;
  readonly status: Extract<MessageStatus, 'QUEUED' | 'SENT' | 'FAILED'>;
  readonly errorReason?: string;
}

export interface InboundMessage {
  readonly waMessageId: string;
  readonly fromPhone: string;
  readonly storePhoneNumberId: string;
  readonly type: Lowercase<MessageType>;
  readonly body: string | null;
  readonly mediaUrl: string | null;
  readonly timestamp: Date;
}

/**
 * WhatsAppProvider — contract implemented by Meta Cloud API and Twilio.
 * The webhook-handler normalizes both into InboundMessage before enqueueing.
 */
export interface WhatsAppProvider {
  readonly name: 'META' | 'TWILIO';
  sendMessage(phoneNumberId: string, message: OutboundMessage): Promise<SendResult>;
}
