import {
  api,
  apiRaw,
  downloadCsv,
  type ApiEnvelope,
  type PaginationMeta,
} from '../../lib/api/client';
import type {
  AiConfigUpdateInput,
  AiConfiguration,
  AiDetectResult,
  AiDraft,
  AiIntent,
  AiIntentInput,
  AiTestResult,
  ChatPage,
  Escalation,
  EscalationCreateInput,
  ListThreadsParams,
  Message,
  MessageStats,
  MessageWithAttachments,
  Thread,
  ThreadsListResult,
} from './types';

/**
 * Typed Messages API surface — WhatsApp inbox (v2 offset listing).
 * Every call reads the `{success, data, meta}` envelope and returns the
 * unwrapped payload. Chat history pages are cursor based (`/messages`),
 * thread sense is offset based (`/message-threads`).
 */

function listParams(params: ListThreadsParams): Record<string, string | number | undefined> {
  return {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    status: params.status || undefined,
    q: params.q || undefined,
    assignedToMe: params.assignedToMe === undefined ? undefined : String(params.assignedToMe),
  };
}

function metaFrom(envelope: ApiEnvelope<unknown, { pagination?: PaginationMeta }>, fallback: PaginationMeta): PaginationMeta {
  return envelope.meta?.pagination ?? fallback;
}

// --- threads (offset listing, decorated customer) ---------------------------

export async function listThreads(params: ListThreadsParams): Promise<ThreadsListResult> {
  const envelope = await api<ApiEnvelope<Thread[], { pagination?: PaginationMeta }>>('/message-threads', {
    params: listParams(params),
  });
  const fallback: PaginationMeta = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
  return { items: envelope.data, meta: metaFrom(envelope, fallback) };
}

export async function getThread(id: string): Promise<Thread> {
  const envelope = await api<ApiEnvelope<Thread>>(`/message-threads/${id}`);
  return envelope.data;
}

export interface UpdateThreadInput {
  status?: 'BOT' | 'HANDLED' | 'CLOSED';
  botEnabled?: boolean;
  assignedUserId?: string | null;
}

export async function updateThread(id: string, input: UpdateThreadInput): Promise<Thread> {
  const envelope = await api<ApiEnvelope<Thread>>(`/message-threads/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return envelope.data;
}

// --- chat history + send ----------------------------------------------------

export async function listThreadMessages(
  threadId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<ChatPage> {
  const envelope = await api<ApiEnvelope<Message[], { pagination?: { nextCursor: string | null } }>>(
    `/message-threads/${threadId}/messages`,
    { params: { limit: opts.limit ?? 50, cursor: opts.cursor || undefined } },
  );
  return { items: envelope.data, nextCursor: envelope.meta?.pagination?.nextCursor ?? null };
}

export interface SendMessageInput {
  type?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE';
  body?: string;
  mediaUrl?: string;
  templateName?: string;
}

export async function sendThreadMessage(threadId: string, input: SendMessageInput): Promise<Message> {
  const envelope = await api<ApiEnvelope<Message>>(`/message-threads/${threadId}/messages`, {
    method: 'POST',
    body: { type: input.type ?? 'TEXT', ...input },
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

// --- store-wide feed / search / stats / export ------------------------------

export interface ListMessagesParams {
  page?: number;
  pageSize?: number;
  threadId?: string;
  customerId?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  q?: string;
  sentByBot?: boolean;
}

export async function listMessages(params: ListMessagesParams = {}): Promise<{ items: MessageWithAttachments[]; meta: PaginationMeta }> {
  const qs: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    threadId: params.threadId || undefined,
    customerId: params.customerId || undefined,
    direction: params.direction || undefined,
  };
  const envelope = await api<ApiEnvelope<MessageWithAttachments[], { pagination?: PaginationMeta }>>(
    params.q ? '/messages/search' : '/messages',
    { params: { ...qs, q: params.q || undefined } },
  );
  const fallback: PaginationMeta = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
  return { items: envelope.data, meta: metaFrom(envelope, fallback) };
}

export async function getMessageStats(from?: string, to?: string): Promise<MessageStats> {
  const envelope = await api<ApiEnvelope<MessageStats>>('/messages/stats', {
    params: { from: from || undefined, to: to || undefined },
  });
  return envelope.data;
}

export function exportMessagesCsv(): void {
  void apiRaw('/messages/export').then((res) => downloadCsv(res, 'messages.csv'));
}

// --- AI configuration -------------------------------------------------------

export async function getAiConfig(): Promise<AiConfiguration> {
  const envelope = await api<ApiEnvelope<AiConfiguration>>('/ai-configurations');
  return envelope.data;
}

export async function updateAiConfig(input: AiConfigUpdateInput): Promise<AiConfiguration> {
  const envelope = await api<ApiEnvelope<AiConfiguration>>('/ai-configurations', {
    method: 'PUT',
    body: input,
  });
  return envelope.data;
}

export async function disableAiConfig(): Promise<void> {
  await api<ApiEnvelope<{ disabled: boolean }>>('/ai-configurations', { method: 'DELETE' });
}

export async function testAiConfig(message: string): Promise<AiTestResult> {
  const envelope = await api<ApiEnvelope<AiTestResult>>('/ai-configurations/test', {
    method: 'POST',
    body: { message },
  });
  return envelope.data;
}

export async function listAiIntents(): Promise<AiIntent[]> {
  const envelope = await api<ApiEnvelope<AiIntent[]>>('/ai-configurations/intents');
  return envelope.data;
}

export async function createAiIntent(input: AiIntentInput): Promise<AiIntent> {
  const envelope = await api<ApiEnvelope<AiIntent>>('/ai-configurations/intents', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function updateAiIntent(intentId: string, input: Partial<AiIntentInput>): Promise<AiIntent> {
  const envelope = await api<ApiEnvelope<AiIntent>>(`/ai-configurations/intents/${intentId}`, {
    method: 'PUT',
    body: input,
  });
  return envelope.data;
}

export async function deleteAiIntent(intentId: string): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>(`/ai-configurations/intents/${intentId}`, { method: 'DELETE' });
}

// --- AI responses (stateless classifier + drafts) ---------------------------

export async function generateAiDraft(input: { threadId?: string; text?: string }): Promise<AiDraft> {
  const envelope = await api<ApiEnvelope<AiDraft>>('/ai-responses/generate', {
    method: 'POST',
    body: input,
  });
  return envelope.data;
}

export async function detectAiIntent(text: string): Promise<AiDetectResult> {
  const envelope = await api<ApiEnvelope<AiDetectResult>>('/ai-responses/detect-intent', {
    method: 'POST',
    body: { text },
  });
  return envelope.data;
}

export async function sendAsBot(threadId: string, body: string): Promise<Message> {
  const envelope = await api<ApiEnvelope<Message>>('/ai-responses/send', {
    method: 'POST',
    body: { threadId, body },
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

// --- escalations ------------------------------------------------------------

export async function listEscalations(params: {
  page?: number;
  pageSize?: number;
  status?: Escalation['status'];
  threadId?: string;
} = {}): Promise<{ items: Escalation[]; meta: PaginationMeta }> {
  const envelope = await api<ApiEnvelope<Escalation[], { pagination?: PaginationMeta }>>('/message-escalations', {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      status: params.status || undefined,
      threadId: params.threadId || undefined,
    },
  });
  const fallback: PaginationMeta = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
  return { items: envelope.data, meta: metaFrom(envelope, fallback) };
}

export async function createEscalation(input: EscalationCreateInput): Promise<Escalation> {
  const envelope = await api<ApiEnvelope<Escalation>>('/message-escalations', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function resolveEscalation(id: string, resolutionNote?: string): Promise<Escalation> {
  const envelope = await api<ApiEnvelope<Escalation>>(`/message-escalations/${id}/resolve`, {
    method: 'POST',
    body: { resolutionNote: resolutionNote || undefined },
  });
  return envelope.data;
}

export async function dismissEscalation(id: string): Promise<void> {
  await api<ApiEnvelope<Escalation>>(`/message-escalations/${id}`, { method: 'DELETE' });
}
