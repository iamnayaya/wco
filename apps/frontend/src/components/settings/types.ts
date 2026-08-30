/**
 * Settings wire + UI models.
 *
 * These mirror the backend domains the Settings page integrates with
 * (auth, whatsapp, ai-configurations, payment-methods, subscriptions,
 * subscription-plans, delivery-*, webhooks, users, stores, uploads).
 * Every Fetched list is returned as `{ success, data, meta }` and unwrapped.
 */

import type { PaginationMeta } from '../../lib/api/client';

// ─── Account ──────────────────────────────────────────────────────

export interface Me {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  merchantId: string;
  merchant?: { id: string; companyName: string; plan: string } | null;
  avatarUrl?: string | null;
}

export interface SellerProfile {
  businessName?: string;
  businessCategory?: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  yearsInBusiness?: number;
  monthlyRevenueBand?: string;
  socials?: Record<string, string>;
}

export interface Session {
  id: string;
  device?: string;
  platform?: string;
  ip?: string;
  location?: string;
  lastActiveAt?: string;
  expiresAt?: string;
  isCurrent?: boolean;
}

export interface TwoFactorSetupResult {
  qrCode?: string;
  secret?: string;
  otpauthUrl?: string;
  backupCodes?: string[];
}

// ─── WhatsApp ─────────────────────────────────────────────────────

export interface WhatsAppConnection {
  phone?: string;
  displayName?: string;
  phoneNumberId?: string;
  wabaId?: string;
  status?: 'NOT_CONNECTED' | 'PENDING' | 'VERIFIED' | 'DISCONNECTED';
  verified?: boolean;
  qrCode?: string;
}

// ─── AI configuration ─────────────────────────────────────────────

export interface AiConfig {
  isEnabled?: boolean;
  autoReplyEnabled?: boolean;
  tone?: 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'CONCISE';
  languages?: string[];
  businessContext?: string | null;
  outOfOfficeBody?: string | null;
  escalationKeywords?: string[];
  workingHours?: {
    start: string;
    end: string;
    days: number[];
  } | null;
  confidenceThreshold?: number;
  primaryModel?: string;
  fallbackModel?: string;
}

// ─── Payments ─────────────────────────────────────────────────────

export interface PaymentMethod {
  id: string;
  type?: 'BANK_ACCOUNT' | 'MOBILE_MONEY' | 'USSD';
  providerName?: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface DeliveryProviderLink {
  id: string;
  providerCode: 'GIG' | 'KWIK' | 'SENDY';
  accountRef?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  areas?: string[];
  createdAt?: string;
}

export interface DeliveryRate {
  id: string;
  zoneName?: string;
  rate?: number;
  freeShippingThreshold?: number;
  createdAt?: string;
}

// ─── Subscription ─────────────────────────────────────────────────

export interface Subscription {
  id: string;
  planCode: 'FREE' | 'STARTER' | 'GROWTH' | 'SCALE';
  status?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  renewsAt?: string;
  cancelAtPeriodEnd?: boolean;
  createdAt?: string;
}

export interface SubscriptionPlan {
  id: string;
  slug?: string;
  name: string;
  code?: string;
  price?: number;
  billing?: string;
  features?: string[];
  limits?: Record<string, number>;
}

// ─── Integrations ─────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretMasked: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix?: string;
  createdAt?: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

// ─── Notifications / Business (local persisted settings) ──────────

export interface NotificationSettings {
  email: { enabled: boolean; events: string[]; frequency: string };
  sms: { enabled: boolean; events: string[]; frequency: string };
  whatsapp: { enabled: boolean; events: string[]; frequency: string };
  push: { enabled: boolean; events: string[]; frequency: string };
  quietHours: { start: string; end: string };
  sound: boolean;
  badge: boolean;
}

export interface BusinessSettings {
  businessName: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  taxRate: number;
  taxMethod: 'INCLUSIVE' | 'EXCLUSIVE';
  currency: string;
  currencyFormat: string;
  language: string;
  supportedLanguages: string[];
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

// ─── Common list result ───────────────────────────────────────────

export interface ListResult<T> {
  items: T[];
  meta: PaginationMeta;
}
