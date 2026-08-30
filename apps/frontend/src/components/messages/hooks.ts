'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as messagesApi from './api';
import type { SendMessageInput, UpdateThreadInput } from './api';
import type { EscalationCreateInput, ListThreadsParams } from './types';

const MESSAGES_KEYS = {
  threads: (params: ListThreadsParams) => ['messages', 'threads', params] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
  chat: (threadId: string) => ['messages', 'chat', threadId] as const,
  feed: (params: Record<string, unknown>) => ['messages', 'feed', params] as const,
  stats: (range: { from?: string; to?: string }) => ['messages', 'stats', range] as const,
  aiConfig: ['messages', 'ai-config'] as const,
  intents: ['messages', 'intents'] as const,
  escalations: (params: Record<string, unknown>) => ['messages', 'escalations', params] as const,
};

const POLL_MS = 15_000;

export function useThreadsList(params: ListThreadsParams) {
  return useQuery({
    queryKey: MESSAGES_KEYS.threads(params),
    queryFn: () => messagesApi.listThreads(params),
    placeholderData: (prev) => prev,
    refetchInterval: POLL_MS,
  });
}

export function useThreadDetail(id: string | null) {
  return useQuery({
    queryKey: MESSAGES_KEYS.thread(id ?? ''),
    queryFn: () => messagesApi.getThread(id as string),
    enabled: Boolean(id),
  });
}

export function useThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: MESSAGES_KEYS.chat(threadId ?? ''),
    queryFn: () => messagesApi.listThreadMessages(threadId as string, { limit: 100 }),
    enabled: Boolean(threadId),
    refetchInterval: POLL_MS,
    select: (data) => ({ ...data, items: [...data.items].reverse() }),
  });
}

export function useMessageStats(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: MESSAGES_KEYS.stats(range),
    queryFn: () => messagesApi.getMessageStats(range.from, range.to),
    refetchInterval: POLL_MS,
  });
}

export function useMessagesFeed(params: { page?: number; pageSize?: number; direction?: 'INBOUND' | 'OUTBOUND' } = {}) {
  return useQuery({
    queryKey: MESSAGES_KEYS.feed(params),
    queryFn: () => messagesApi.listMessages(params),
    placeholderData: (prev) => prev,
  });
}

export function useAiConfig() {
  return useQuery({
    queryKey: MESSAGES_KEYS.aiConfig,
    queryFn: () => messagesApi.getAiConfig(),
  });
}

export function useAiIntents() {
  return useQuery({
    queryKey: MESSAGES_KEYS.intents,
    queryFn: () => messagesApi.listAiIntents(),
  });
}

export function useEscalations(params: { page?: number; pageSize?: number; status?: string; threadId?: string } = {}) {
  return useQuery({
    queryKey: MESSAGES_KEYS.escalations(params),
    queryFn: () =>
      messagesApi.listEscalations({
        ...params,
        status: (params.status ?? undefined) as never,
      }),
    placeholderData: (prev) => prev,
  });
}

// --- mutations --------------------------------------------------------------

export function useUpdateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateThreadInput }) =>
      messagesApi.updateThread(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.threads({}) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.thread(vars.id) });
    },
  });
}

export function useSendThreadMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, input }: { threadId: string; input: SendMessageInput }) =>
      messagesApi.sendThreadMessage(threadId, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.chat(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.thread(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.threads({}) });
    },
  });
}

export function useGenerateAiDraft() {
  return useMutation({
    mutationFn: (input: { threadId?: string; text?: string }) => messagesApi.generateAiDraft(input),
  });
}

export function useSendAsBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      messagesApi.sendAsBot(threadId, body),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.chat(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.thread(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.threads({}) });
    },
  });
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof messagesApi.updateAiConfig>[0]) => messagesApi.updateAiConfig(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.aiConfig });
    },
  });
}

export function useCreateIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof messagesApi.createAiIntent>[0]) => messagesApi.createAiIntent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.intents });
    },
  });
}

export function useDeleteIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intentId: string) => messagesApi.deleteAiIntent(intentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.intents });
    },
  });
}

export function useCreateEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EscalationCreateInput) => messagesApi.createEscalation(input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.escalations({}) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.stats({}) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.thread(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.threads({}) });
    },
  });
}

export function useResolveEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => messagesApi.resolveEscalation(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.escalations({}) });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEYS.stats({}) });
    },
  });
}

// --- helpers to share query keys across modules -----------------------------

export const messagesKeys = MESSAGES_KEYS;
