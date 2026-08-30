'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from './api';
import type { AiConfig, NotificationSettings, SellerProfile } from './types';

const KEYS = {
  me: ['settings', 'me'] as const,
  sellerProfile: ['settings', 'seller-profile'] as const,
  sessions: ['settings', 'sessions'] as const,
  whatsapp: ['settings', 'whatsapp'] as const,
  ai: ['settings', 'ai'] as const,
  paymentMethods: ['settings', 'payment-methods'] as const,
  deliveryProviders: ['settings', 'delivery-providers'] as const,
  deliveryZones: ['settings', 'delivery-zones'] as const,
  deliveryRates: ['settings', 'delivery-rates'] as const,
  subscription: ['settings', 'subscription'] as const,
  plans: ['settings', 'plans'] as const,
  webhooks: ['settings', 'webhooks'] as const,
  apiKeys: ['settings', 'api-keys'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────

export function useMe() {
  return useQuery({ queryKey: KEYS.me, queryFn: () => settingsApi.getMe(), placeholderData: (prev) => prev });
}

export function useSellerProfile() {
  return useQuery({ queryKey: KEYS.sellerProfile, queryFn: () => settingsApi.getSellerProfile(), placeholderData: (prev) => prev });
}

export function useSessions() {
  return useQuery({ queryKey: KEYS.sessions, queryFn: () => settingsApi.listSessions(), placeholderData: (prev) => prev });
}

export function useWhatsAppConnection() {
  return useQuery({ queryKey: KEYS.whatsapp, queryFn: () => settingsApi.getWhatsAppConnection(), placeholderData: (prev) => prev });
}

export function useAiConfig() {
  return useQuery({ queryKey: KEYS.ai, queryFn: () => settingsApi.getAiConfig(), placeholderData: (prev) => prev });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: KEYS.paymentMethods, queryFn: () => settingsApi.listPaymentMethods(), placeholderData: (prev) => prev });
}

export function useDeliveryProviders() {
  return useQuery({ queryKey: KEYS.deliveryProviders, queryFn: () => settingsApi.listDeliveryProviders(), placeholderData: (prev) => prev });
}

export function useDeliveryZones() {
  return useQuery({ queryKey: KEYS.deliveryZones, queryFn: () => settingsApi.listDeliveryZones(), placeholderData: (prev) => prev });
}

export function useDeliveryRates() {
  return useQuery({ queryKey: KEYS.deliveryRates, queryFn: () => settingsApi.listDeliveryRates(), placeholderData: (prev) => prev });
}

export function useMySubscription() {
  return useQuery({ queryKey: KEYS.subscription, queryFn: () => settingsApi.getMySubscription(), placeholderData: (prev) => prev });
}

export function usePlans() {
  return useQuery({ queryKey: KEYS.plans, queryFn: () => settingsApi.listPlans(), placeholderData: (prev) => prev });
}

export function useWebhooks() {
  return useQuery({ queryKey: KEYS.webhooks, queryFn: () => settingsApi.listWebhooks(), placeholderData: (prev) => prev });
}

export function useApiKeys() {
  return useQuery({ queryKey: KEYS.apiKeys, queryFn: () => settingsApi.listApiKeys(), placeholderData: (prev) => prev });
}

// ─── Mutations ───────────────────────────────────────────────────

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fullName?: string; phone?: string; settings?: Record<string, unknown> }) => settingsApi.updateMe(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.me }); },
  });
}

export function useUpdateSellerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SellerProfile>) => settingsApi.updateSellerProfile(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.sellerProfile }); },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadAvatar(file),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.me }); },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => settingsApi.changePassword(input),
  });
}

export function useSetup2fa() {
  return useMutation({ mutationFn: () => settingsApi.setup2fa() });
}

export function useEnable2fa() {
  return useMutation({ mutationFn: (code: string) => settingsApi.enable2fa(code) });
}

export function useDisable2fa() {
  return useMutation({ mutationFn: (password: string) => settingsApi.disable2fa(password) });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.deleteAccount(),
    onSuccess: () => { qc.clear(); },
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => settingsApi.revokeSession(sessionId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.sessions }); },
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refreshToken?: string) => settingsApi.revokeOtherSessions(refreshToken),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.sessions }); },
  });
}

export function useConnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; displayName?: string }) => settingsApi.connectWhatsApp(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.whatsapp }); },
  });
}

export function useVerifyWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { phoneNumberId: string; wabaId?: string }) => settingsApi.verifyWhatsApp(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.whatsapp }); },
  });
}

export function useDisconnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.disconnectWhatsApp(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.whatsapp }); },
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AiConfig>) => settingsApi.updateAiConfig(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.ai }); },
  });
}

export function useTestAi() {
  return useMutation({ mutationFn: (message: string) => settingsApi.testAi(message) });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof settingsApi.createPaymentMethod>[0]) => settingsApi.createPaymentMethod(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.paymentMethods }); },
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { isDefault?: boolean; accountName?: string } }) => settingsApi.updatePaymentMethod(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.paymentMethods }); },
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deletePaymentMethod(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.paymentMethods }); },
  });
}

export function useLinkDeliveryProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof settingsApi.linkDeliveryProvider>[0]) => settingsApi.linkDeliveryProvider(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.deliveryProviders }); },
  });
}

export function useUpdateDeliveryProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { isDefault?: boolean; isActive?: boolean; accountRef?: string } }) => settingsApi.updateDeliveryProvider(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.deliveryProviders }); },
  });
}

export function useUpgradeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planCode: string; billingCycle?: 'MONTHLY' | 'YEARLY' }) => settingsApi.upgradeSubscription(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.subscription });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: { reason?: string }) => settingsApi.cancelSubscription(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.subscription }); },
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; events: string[] }) => settingsApi.createWebhook(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.webhooks }); },
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { url?: string; events?: string[]; isActive?: boolean } }) => settingsApi.updateWebhook(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.webhooks }); },
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteWebhook(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.webhooks }); },
  });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotificationSettings) => settingsApi.saveNotificationSettings(settings),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.me }); },
  });
}
