import { createHmac, timingSafeEqual } from 'node:crypto';

import type { InboundMessage } from '@wco/messaging';
import { ForbiddenError, ValidationError } from '@wco/shared';

import { env, isProd } from '../../../config/env.js';

/**
 * Meta WhatsApp Cloud API webhook plumbing.
 *
 * Security contract:
 *  - GET  /webhooks/inbound/whatsapp  -> subscription handshake (hub.challenge
 *    echoed only when hub.verify_token matches).
 *  - POST /webhooks/inbound/whatsapp  -> X-Hub-Signature-256 = HMAC-SHA256(raw
 *    body, META_APP_SECRET), compared in constant time. When the app secret is
 *    not configured (local dev) unsigned traffic is accepted ONLY outside
 *    production; a present-but-invalid signature is always rejected.
 */

export function verifyMetaSignature(rawBody: Buffer | string, signatureHeader: string | undefined): void {
  if (env.META_APP_SECRET === undefined) {
    if (isProd) throw new ForbiddenError('META_APP_SECRET must be configured in production');
    return;
  }
  if (signatureHeader === undefined || !signatureHeader.startsWith('sha256=')) {
    throw new ForbiddenError('Missing X-Hub-Signature-256');
  }
  const expected = createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError('Invalid webhook signature');
  }
}

/** GET handler body: returns the challenge when the token matches. */
export function metaHandshake(query: {
  mode?: unknown;
  verifyToken?: unknown;
  challenge?: unknown;
}): string {
  const mode = typeof query.mode === 'string' ? query.mode : '';
  const token = typeof query.verifyToken === 'string' ? query.verifyToken : '';
  const challenge = typeof query.challenge === 'string' ? query.challenge : '';
  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN && challenge.length > 0) {
    return challenge;
  }
  throw new ForbiddenError('Webhook verification failed');
}

interface MetaTextBody {
  readonly body?: unknown;
}
interface MetaImageish {
  readonly link?: unknown;
  readonly caption?: unknown;
}
interface MetaInboundMessageShape {
  readonly id?: unknown;
  readonly from?: unknown;
  readonly timestamp?: unknown;
  readonly type?: unknown;
  readonly text?: MetaTextBody;
  readonly image?: MetaImageish;
  readonly audio?: MetaImageish;
  readonly video?: MetaImageish;
  readonly document?: MetaImageish;
  readonly location?: unknown;
  readonly button?: unknown;
  readonly interactive?: unknown;
}
interface MetaWebhookPayload {
  readonly entry?: ReadonlyArray<{
    readonly changes?: ReadonlyArray<{
      readonly value?: MetaChangeValue;
    }>;
  }>;
}
// Meta's wire format is snake_case; the naming rule only knows camelCase.
/* eslint-disable @typescript-eslint/naming-convention */
interface MetaChangeValue {
  readonly metadata?: { readonly phone_number_id?: unknown };
  readonly contacts?: ReadonlyArray<{ readonly wa_id?: unknown }>;
  readonly messages?: ReadonlyArray<MetaInboundMessageShape>;
}
/* eslint-enable @typescript-eslint/naming-convention */

const INBOUND_TYPES = ['text', 'image', 'audio', 'video', 'document', 'location', 'template', 'interactive'] as const;

type InboundType = (typeof INBOUND_TYPES)[number];

/** Extract body/media for one Meta message; unknown shapes yield nulls. */
function extractMessageContent(
  message: MetaInboundMessageShape,
  type: InboundType,
): { body: string | null; mediaUrl: string | null } {
  if (type === 'text') {
    const body = message.text?.body;
    return { body: typeof body === 'string' ? body : null, mediaUrl: null };
  }
  if (type === 'image' || type === 'audio' || type === 'video' || type === 'document') {
    const media = message[type];
    const link = media === undefined ? undefined : media.link;
    return { body: null, mediaUrl: typeof link === 'string' ? link : null };
  }
  return { body: null, mediaUrl: null };
}

/** One flattened message, or null when required fields are missing. */
function toInboundMessage(message: MetaInboundMessageShape, phoneNumberId: string): (InboundMessage & { readonly storePhoneNumberId: string }) | null {
  const waMessageId = message.id;
  const fromPhone = message.from;
  if (typeof waMessageId !== 'string' || typeof fromPhone !== 'string') return null;
  const rawType = typeof message.type === 'string' && INBOUND_TYPES.includes(message.type as InboundType)
    ? (message.type as InboundType)
    : null;
  if (rawType === null) return null;

  const { body, mediaUrl } = extractMessageContent(message, rawType);
  const ts = message.timestamp;
  const timestamp =
    typeof ts === 'string' && /^\d+$/.test(ts) ? new Date(Number(ts) * 1000) : new Date();

  return {
    waMessageId,
    fromPhone: `+${fromPhone.replace(/^\+/, '')}`,
    storePhoneNumberId: phoneNumberId,
    type: rawType,
    body,
    mediaUrl,
    timestamp,
  };
}

/**
 * Flatten Meta's nested webhook JSON into one NormalizedInbound per message.
 * Malformed entries are skipped (never throw - Meta retries on non-2xx and we
 * do not want poison payloads wedging the subscription).
 */
export function normalizeMetaPayload(payload: unknown): Array<InboundMessage & { readonly storePhoneNumberId: string }> {
  const shape = payload as MetaWebhookPayload;
  const out: Array<InboundMessage & { readonly storePhoneNumberId: string }> = [];

  for (const entry of shape.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (typeof phoneNumberId !== 'string' || phoneNumberId.length === 0) continue;

      for (const message of value?.messages ?? []) {
        const normalized = toInboundMessage(message, phoneNumberId);
        if (normalized !== null) out.push(normalized);
      }
    }
  }
  return out;
}

/** Guard for POST /messages/receive (testing + backfill ingress). */
export function assertIngressAllowed(reqHeaders: Record<string, unknown>, nodeEnv: string): void {
  if (env.WEBHOOK_INGRESS_KEY !== undefined) {
    const provided = reqHeaders['x-wco-ingress-key'];
    if (provided !== env.WEBHOOK_INGRESS_KEY) {
      throw new ForbiddenError('Invalid ingress key');
    }
    return;
  }
  if (nodeEnv === 'production') {
    throw new ForbiddenError('Ingress requires WEBHOOK_INGRESS_KEY in production');
  }
}

/** Shared validation so both webhook + ingress produce identical errors. */
export function requireNonEmptyBody(inbound: { readonly body: string | null; readonly mediaUrl: string | null; readonly type: string }): void {
  if (inbound.body === null && inbound.mediaUrl === null) {
    throw new ValidationError(`Unsupported ${inbound.type} message without body or media`);
  }
}
