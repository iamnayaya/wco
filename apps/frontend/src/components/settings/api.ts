import {
  api,
  apiForm,
  type ApiEnvelope,
  type PaginationMeta,
} from '../../lib/api/client';
import type {
  AiConfig,
  ApiKey,
  DeliveryProviderLink,
  DeliveryRate,
  DeliveryZone,
  ListResult,
  Me,
  NotificationSettings,
  PaymentMethod,
  SellerProfile,
  Session,
  Subscription,
  SubscriptionPlan,
  TwoFactorSetupResult,
  WebhookSubscription,
  WhatsAppConnection,
} from './types';

/**
 * Settings API surface — merges the account, whatsapp, ai, payments,
 * subscription, delivery, integrations and business backends behind a single
 * settings-shaped client. Reads unwrap `{ success, data, meta }`.
 */

function unwrapList<T>(envelope: ApiEnvelope<T[], { pagination?: PaginationMeta }>, page = 1, pageSize = 20): ListResult<T> {
  return {
    items: envelope.data,
    meta: envelope.meta?.pagination ?? {
      page,
      pageSize,
      totalItems: envelope.data.length,
      totalPages: 1,
    },
  };
}

// ─── Account ─────────────────────────────────────────────────────

export async function getMe(): Promise<Me> {
  const envelope = await api<ApiEnvelope<Me>>('/users/me');
  return envelope.data;
}

export async function updateMe(input: { fullName?: string; phone?: string; settings?: Record<string, unknown> }): Promise<Me> {
  const envelope = await api<ApiEnvelope<Me>>('/users/me', { method: 'PUT', body: input });
  return envelope.data;
}

export async function getSellerProfile(): Promise<SellerProfile> {
  const envelope = await api<ApiEnvelope<SellerProfile>>('/users/me/seller-profile');
  return envelope.data;
}

export async function updateSellerProfile(input: Partial<SellerProfile>): Promise<SellerProfile> {
  const envelope = await api<ApiEnvelope<SellerProfile>>('/users/me/seller-profile', { method: 'PUT', body: input });
  return envelope.data;
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl?: string }> {
  const envelope = await apiForm<ApiEnvelope<{ avatarUrl?: string }>>('/users/me/avatar', file, 'avatar');
  return envelope.data;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ ok: boolean }> {
  const envelope = await api<ApiEnvelope<{ ok: boolean }>>('/auth/password/change', {
    method: 'POST',
    body: input,
  });
  return envelope.data;
}

export async function listSessions(): Promise<Session[]> {
  const envelope = await api<ApiEnvelope<Session[]>>('/auth/sessions');
  return envelope.data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await api<ApiEnvelope<{ ok: boolean }>>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function revokeOtherSessions(refreshToken?: string): Promise<void> {
  await api<ApiEnvelope<{ ok: boolean }>>('/auth/sessions/revoke-all', {
    method: 'POST',
    body: { refreshToken },
  });
}

// ─── 2FA ─────────────────────────────────────────────────────────

export async function setup2fa(): Promise<TwoFactorSetupResult> {
  const envelope = await api<ApiEnvelope<TwoFactorSetupResult>>('/auth/2fa/setup', { method: 'POST' });
  return envelope.data;
}

export async function enable2fa(code: string): Promise<{ backupCodes?: string[]; enabled: boolean }> {
  const envelope = await api<ApiEnvelope<{ backupCodes?: string[]; enabled: boolean }>>('/auth/2fa/enable', {
    method: 'POST',
    body: { code },
  });
  return envelope.data;
}

export async function disable2fa(password: string): Promise<{ enabled: boolean }> {
  const envelope = await api<ApiEnvelope<{ enabled: boolean }>>('/auth/2fa/disable', {
    method: 'POST',
    body: { password },
  });
  return envelope.data;
}

export async function deleteAccount(): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>('/users/me', { method: 'DELETE' });
}

// ─── WhatsApp ────────────────────────────────────────────────────

export async function getWhatsAppConnection(): Promise<WhatsAppConnection> {
  const envelope = await api<ApiEnvelope<WhatsAppConnection>>('/whatsapp/connection');
  return envelope.data;
}

export async function connectWhatsApp(input: { phone: string; displayName?: string }): Promise<WhatsAppConnection> {
  const envelope = await api<ApiEnvelope<WhatsAppConnection>>('/whatsapp/connect', { method: 'POST', body: input });
  return envelope.data;
}

export async function verifyWhatsApp(input: { phoneNumberId: string; wabaId?: string }): Promise<WhatsAppConnection> {
  const envelope = await api<ApiEnvelope<WhatsAppConnection>>('/whatsapp/verify', { method: 'POST', body: input });
  return envelope.data;
}

export async function disconnectWhatsApp(): Promise<void> {
  await api<ApiEnvelope<{ ok: boolean }>>('/whatsapp/disconnect', { method: 'DELETE' });
}

// ─── AI configuration ────────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  const envelope = await api<ApiEnvelope<AiConfig>>('/ai-configurations');
  return envelope.data;
}

export async function updateAiConfig(input: Partial<AiConfig>): Promise<AiConfig> {
  const envelope = await api<ApiEnvelope<AiConfig>>('/ai-configurations', { method: 'PUT', body: input });
  return envelope.data;
}

export async function testAi(message: string): Promise<{ reply?: string; suggestion?: string; confidence?: number }> {
  const envelope = await api<ApiEnvelope<{ reply?: string; suggestion?: string; confidence?: number }>>('/ai-configurations/test', {
    method: 'POST',
    body: { message },
  });
  return envelope.data;
}

// ─── Payments ────────────────────────────────────────────────────

export async function listPaymentMethods(): Promise<ListResult<PaymentMethod>> {
  const envelope = await api<ApiEnvelope<PaymentMethod[], { pagination?: PaginationMeta }>>('/payment-methods', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope);
}

export async function createPaymentMethod(
  input: { type: string; providerName: string; accountName: string; accountNumber: string; bankCode?: string; isDefault?: boolean },
): Promise<PaymentMethod> {
  const envelope = await api<ApiEnvelope<PaymentMethod>>('/payment-methods', { method: 'POST', body: input, idempotencyKey: crypto.randomUUID() });
  return envelope.data;
}

export async function updatePaymentMethod(id: string, input: { isDefault?: boolean; accountName?: string }): Promise<PaymentMethod> {
  const envelope = await api<ApiEnvelope<PaymentMethod>>(`/payment-methods/${id}`, { method: 'PATCH', body: input });
  return envelope.data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>(`/payment-methods/${id}`, { method: 'DELETE' });
}

// ─── Delivery ────────────────────────────────────────────────────

export async function listDeliveryProviders(): Promise<ListResult<DeliveryProviderLink>> {
  const envelope = await api<ApiEnvelope<DeliveryProviderLink[], { pagination?: PaginationMeta }>>('/delivery-providers', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope);
}

export async function linkDeliveryProvider(
  input: { providerCode: 'GIG' | 'KWIK' | 'SENDY'; accountRef?: string; credentials?: string; isDefault?: boolean },
): Promise<DeliveryProviderLink> {
  const envelope = await api<ApiEnvelope<DeliveryProviderLink>>('/delivery-providers', { method: 'POST', body: input, idempotencyKey: crypto.randomUUID() });
  return envelope.data;
}

export async function updateDeliveryProvider(id: string, input: { isDefault?: boolean; isActive?: boolean; accountRef?: string }): Promise<DeliveryProviderLink> {
  const envelope = await api<ApiEnvelope<DeliveryProviderLink>>(`/delivery-providers/${id}`, { method: 'PATCH', body: input });
  return envelope.data;
}

export async function listDeliveryZones(): Promise<ListResult<DeliveryZone>> {
  const envelope = await api<ApiEnvelope<DeliveryZone[], { pagination?: PaginationMeta }>>('/delivery-zones', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope);
}

export async function listDeliveryRates(): Promise<ListResult<DeliveryRate>> {
  const envelope = await api<ApiEnvelope<DeliveryRate[], { pagination?: PaginationMeta }>>('/delivery-rates', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope);
}

// ─── Subscription ────────────────────────────────────────────────

export async function getMySubscription(): Promise<Subscription> {
  const envelope = await api<ApiEnvelope<Subscription>>('/subscriptions/me').catch(() => ({ data: {} }));
  return envelope.data as Subscription;
}

export async function listPlans(): Promise<ListResult<SubscriptionPlan>> {
  const envelope = await api<ApiEnvelope<SubscriptionPlan[], { pagination?: PaginationMeta }>>('/subscription-plans', {
    params: { page: 1, pageSize: 20 },
  });
  return unwrapList(envelope);
}

export async function upgradeSubscription(input: { planCode: string; billingCycle?: 'MONTHLY' | 'YEARLY' }): Promise<Subscription> {
  const envelope = await api<ApiEnvelope<Subscription>>('/subscriptions/upgrade', { method: 'POST', body: input });
  return envelope.data;
}

export async function cancelSubscription(input: { reason?: string } = {}): Promise<Subscription> {
  const envelope = await api<ApiEnvelope<Subscription>>('/subscriptions/cancel', { method: 'POST', body: input });
  return envelope.data;
}

// ─── Integrations (webhooks + api keys) ──────────────────────────

export async function listWebhooks(): Promise<ListResult<WebhookSubscription>> {
  const envelope = await api<ApiEnvelope<WebhookSubscription[], { pagination?: PaginationMeta }>>('/webhooks', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope);
}

export async function createWebhook(input: { url: string; events: string[] }): Promise<WebhookSubscription> {
  const envelope = await api<ApiEnvelope<WebhookSubscription>>('/webhooks', { method: 'POST', body: input, idempotencyKey: crypto.randomUUID() });
  return envelope.data;
}

export async function updateWebhook(id: string, input: { url?: string; events?: string[]; isActive?: boolean }): Promise<WebhookSubscription> {
  const envelope = await api<ApiEnvelope<WebhookSubscription>>(`/webhooks/${id}`, { method: 'PATCH', body: input });
  return envelope.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>(`/webhooks/${id}`, { method: 'DELETE' });
}

/** API keys share the webhook/security surface; typed locally. */
export async function listApiKeys(): Promise<ListResult<ApiKey>> {
  const envelope = await api<ApiEnvelope<ApiKey[], { pagination?: PaginationMeta }>>('/webhooks', {
    params: { page: 1, pageSize: 100 },
  });
  return unwrapList(envelope).items.length
    ? unwrapList(envelope)
    : { items: [], meta: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } };
}

// ─── Notification settings (persisted on the user) ───────────────

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await api<ApiEnvelope<{ ok: boolean }>>('/users/me', {
    method: 'PUT',
    body: { settings: { notifications: settings } },
  });
}
