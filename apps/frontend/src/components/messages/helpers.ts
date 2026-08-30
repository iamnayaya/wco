import type { ConversationStatus, EscalationReason, MessageStatus, MessageType } from './types';

/**
 * Human-facing labels + tones for messaging domain enums.
 * Kept in one module so badges/aria labels stay consistent.
 */

export function statusTone(status: ConversationStatus): string {
  switch (status) {
    case 'BOT':
      return 'PENDING_PAYMENT';
    case 'HANDLED':
      return 'PAID';
    case 'CLOSED':
      return 'CANCELLED';
    default:
      return '';
  }
}

export function statusLabel(status: ConversationStatus): string {
  switch (status) {
    case 'BOT':
      return 'AI handles';
    case 'HANDLED':
      return 'You handle';
    case 'CLOSED':
      return 'Closed';
    default:
      return status;
  }
}

export function messageStatusLabel(status: MessageStatus): string {
  switch (status) {
    case 'QUEUED':
      return 'Queued';
    case 'SENT':
      return 'Sent';
    case 'DELIVERED':
      return 'Delivered';
    case 'READ':
      return 'Read';
    case 'FAILED':
      return 'Failed';
    case 'RECEIVED':
      return 'Received';
    default:
      return status;
  }
}

export function messageStatusTone(status: MessageStatus): string {
  switch (status) {
    case 'FAILED':
      return 'CANCELLED';
    case 'SENT':
    case 'DELIVERED':
    case 'READ':
    case 'RECEIVED':
      return 'PAID';
    case 'QUEUED':
      return 'PENDING_PAYMENT';
    default:
      return '';
  }
}

export function messageTypeLabel(type: MessageType): string {
  switch (type) {
    case 'TEXT':
      return 'Text';
    case 'IMAGE':
      return 'Image';
    case 'AUDIO':
      return 'Audio';
    case 'VIDEO':
      return 'Video';
    case 'DOCUMENT':
      return 'Document';
    case 'LOCATION':
      return 'Location';
    case 'TEMPLATE':
      return 'Template';
    case 'INTERACTIVE':
      return 'Interactive';
    default:
      return type;
  }
}

export function escalationReasonLabel(reason: EscalationReason): string {
  return reason
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayName(phone: string, name: string | null): string {
  return name || phone;
}
