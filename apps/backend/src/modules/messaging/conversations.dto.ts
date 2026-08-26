import { z } from 'zod';

/** Conversations DTOs - the WhatsApp inbox. */

export const listConversationsQuerySchema = z.object({
  status: z.enum(['BOT', 'HANDLED', 'CLOSED']).optional(),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(255).optional(),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(255).optional(),
});

export const sendMessageSchema = z
  .object({
    body: z.string().max(4096).optional(),
    type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT']).default('TEXT'),
    mediaUrl: z.string().url().optional(),
  })
  .refine((v) => Boolean(v.body) || v.type !== 'TEXT', {
    message: 'Text messages require a body',
    path: ['body'],
  })
  .refine((v) => v.type === 'TEXT' || Boolean(v.mediaUrl), {
    message: 'Media messages require mediaUrl',
    path: ['mediaUrl'],
  });

export const assignAgentSchema = z.object({ userId: z.string().min(1).nullable() });

export const botToggleSchema = z.object({ enabled: z.boolean() });

export const idParams = z.object({ id: z.string().min(1) });

export type ListConversationsQueryDto = z.infer<typeof listConversationsQuerySchema>;
export type ListMessagesQueryDto = z.infer<typeof listMessagesQuerySchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
