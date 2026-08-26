import { z } from 'zod';

/**
 * Messages module DTOs. Every route validates through these; services trust
 * nothing raw. Mirrors the orders/products v2 conventions (coerced pagination,
 * literal-before-wildcard params, refine() for cross-field rules).
 */

// --- shared primitives --------------------------------------------------------

export const idParams = z.object({ id: z.string().min(1) });

export const threadParams = z.object({ id: z.string().min(1) });

export const messageParams = z.object({ id: z.string().min(1), messageId: z.string().min(1) });

export const escalationParams = z.object({ id: z.string().min(1) });

const phone = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, 'E.164 phone number required (e.g. +2348012345678)');

// --- WhatsApp connection -------------------------------------------------------

export const connectWhatsAppSchema = z.object({
  phone,
  /** Meta Cloud API display name for the number (informational). */
  displayName: z.string().max(120).optional(),
});

export const verifyWhatsAppSchema = z.object({
  /** Meta-issued phone number id once the number passes business verification. */
  phoneNumberId: z.string().min(3).max(64),
  wabaId: z.string().max(64).optional(),
});

// --- threads ---------------------------------------------------------------------

export const createThreadSchema = z.object({
  customerId: z.string().min(1),
});

export const updateThreadSchema = z
  .object({
    status: z.enum(['BOT', 'HANDLED', 'CLOSED']).optional(),
    botEnabled: z.boolean().optional(),
    assignedUserId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listThreadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['BOT', 'HANDLED', 'CLOSED']).optional(),
  q: z.string().max(120).optional(),
  customerId: z.string().min(1).optional(),
  assignedToMe: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const threadMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(255).optional(),
});

// --- messages ---------------------------------------------------------------------

const outboundFields = {
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO']).default('TEXT'),
  body: z.string().max(4096).optional(),
  mediaUrl: z.string().url().max(2048).optional(),
  templateName: z.string().max(120).optional(),
  templateParams: z.array(z.string().max(256)).max(10).optional(),
};

/** Cross-field rules shared by every outbound variant. */
function refineOutbound(
  schema: z.ZodObject<typeof outboundFields>,
): z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<typeof outboundFields>>>> {
  return schema
    .refine((v) => Boolean(v.body ?? v.mediaUrl ?? v.templateName), {
      message: 'Message requires body, mediaUrl or templateName',
    })
    .refine((v) => v.type !== 'TEXT' || Boolean(v.body), { message: 'Text messages require a body' })
    .refine((v) => !['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'].includes(v.type) || Boolean(v.mediaUrl), {
      message: 'Media messages require mediaUrl',
    });
}

export const outboundBody = refineOutbound(z.object(outboundFields));

export const sendMessageSchema = z.union([
  refineOutbound(z.object({ ...outboundFields, threadId: z.string().min(1) })),
  refineOutbound(z.object({ ...outboundFields, customerId: z.string().min(1) })),
]);

/** Testing/backfill ingress - same pipeline as the signed Meta webhook. */
export const receiveMessageSchema = z.object({
  storePhoneNumberId: z.string().min(3).max(64),
  fromPhone: phone,
  waMessageId: z.string().min(3).max(128),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'location', 'template', 'interactive']).default('text'),
  body: z.string().max(65_535).nullish(),
  mediaUrl: z.string().url().max(2048).nullish(),
  timestamp: z.coerce.date().optional(),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  threadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  type: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'INTERACTIVE']).optional(),
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED']).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  sort: z.enum(['createdAt_asc', 'createdAt_desc']).default('createdAt_desc'),
});

export const searchMessagesQuerySchema = listMessagesQuerySchema.extend({
  q: z.string().min(1).max(120),
});

export const updateMessageSchema = z
  .object({
    body: z.string().max(4096).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

// --- AI configuration --------------------------------------------------------------

export const aiConfigUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  autoReplyEnabled: z.boolean().optional(),
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'CONCISE']).optional(),
  languages: z.array(z.enum(['en', 'pcm', 'ha', 'yo', 'ig', 'sw', 'fr'])).min(1).max(7).optional(),
  businessContext: z.string().max(8000).nullish(),
  outOfOfficeBody: z.string().max(1000).nullish(),
  escalationKeywords: z.array(z.string().min(2).max(40)).max(30).optional(),
  workingHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      days: z.array(z.number().int().min(0).max(6)).max(7),
    })
    .optional(),
  confidenceThreshold: z.number().min(0.1).max(1).optional(),
  primaryModel: z.string().max(80).optional(),
  fallbackModel: z.string().max(80).optional(),
});

export const aiTestSchema = z.object({
  message: z.string().min(1).max(2000),
});

// --- AI intents catalog ---------------------------------------------------------------

export const aiIntentBodySchema = z.object({
  name: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'UPPER_SNAKE_CASE name required'),
  keywords: z.array(z.string().min(2).max(60)).min(1).max(30),
  sampleUtterances: z.array(z.string().min(2).max(300)).max(20).optional(),
  cannedResponse: z.string().max(2000).nullish(),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const aiIntentParams = z.object({ intentId: z.string().min(1) });

// --- AI responses -------------------------------------------------------------------------

export const aiDetectIntentSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const aiGenerateSchema = z.object({
  threadId: z.string().min(1).optional(),
  text: z.string().max(2000).optional(),
});

export const aiSendSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).max(4096),
});

// --- escalations ------------------------------------------------------------------------------

export const escalationCreateSchema = z.object({
  threadId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  reason: z.enum([
    'LOW_CONFIDENCE',
    'COMPLAINT',
    'REFUND_REQUEST',
    'PAYMENT_ISSUE',
    'CUSTOM_QUOTE',
    'HUMAN_REQUESTED',
    'NEGATIVE_SENTIMENT',
  ]),
  notes: z.string().max(2000).optional(),
});

export const escalationUpdateSchema = z
  .object({
    notes: z.string().max(2000).nullish(),
    assignedUserId: z.string().min(1).nullable().optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const escalationResolveSchema = z.object({
  resolutionNote: z.string().max(2000).optional(),
});

export const listEscalationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
  reason: z
    .enum([
      'LOW_CONFIDENCE',
      'COMPLAINT',
      'REFUND_REQUEST',
      'PAYMENT_ISSUE',
      'CUSTOM_QUOTE',
      'HUMAN_REQUESTED',
      'NEGATIVE_SENTIMENT',
    ])
    .optional(),
  threadId: z.string().min(1).optional(),
});

// --- attachments ---------------------------------------------------------------------------------

export const attachmentParams = z.object({
  id: z.string().min(1),
  attachmentId: z.string().min(1),
});

// --- stats ---------------------------------------------------------------------------------

export const messageStatsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
