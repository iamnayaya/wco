import { z } from 'zod';
import type { BusinessSettings, NotificationSettings } from './types';

/**
 * Settings helpers — curated option lists, label maps, and form validation
 * schemas (zod). Centralizing options keeps tabs consistent and i18n-ready.
 */

// ─── Curated option lists ────────────────────────────────────────

export const TONES: Array<{ value: 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'CONCISE'; label: string }> = [
  { value: 'FRIENDLY', label: 'Friendly' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'PLAYFUL', label: 'Playful' },
  { value: 'CONCISE', label: 'Concise' },
];

export const AI_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'pcm', label: 'Pidgin (Naija)' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
  { value: 'sw', label: 'Swahili' },
  { value: 'fr', label: 'French' },
];

export const CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira (₦)' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi (GH₵)' },
  { value: 'KES', label: 'KES — Kenyan Shilling (KSh)' },
  { value: 'USD', label: 'USD — US Dollar ($)' },
];

export const TIMEZONES = [
  { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (UTC+3)' },
  { value: 'UTC', label: 'UTC' },
];

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export const PLAN_CODES = [
  { value: 'FREE', label: 'Free' },
  { value: 'STARTER', label: 'Starter' },
  { value: 'GROWTH', label: 'Growth' },
  { value: 'SCALE', label: 'Scale' },
];

export const PLANS: Array<{ code: string; name: string; price: string; period: string; features: string[]; popular?: boolean }> = [
  {
    code: 'FREE',
    name: 'Free',
    price: '₦0',
    period: 'forever',
    features: ['Up to 100 products', '1 staff member', '50 AI replies/day', 'Community support'],
  },
  {
    code: 'STARTER',
    name: 'Starter',
    price: '₦7,500',
    period: '/month',
    features: ['Up to 1,000 products', '5 staff members', 'Unlimited AI replies', 'Email support'],
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    price: '₦25,000',
    period: '/month',
    features: ['Unlimited products', '25 staff members', 'Advanced AI + insights', 'Priority support'],
    popular: true,
  },
  {
    code: 'SCALE',
    name: 'Scale',
    price: '₦85,000',
    period: '/month',
    features: ['Everything in Growth', 'Unlimited staff', 'Dedicated manager', 'SLA + onboarding'],
  },
];

export const NOTIFY_EVENTS = [
  { value: 'orders', label: 'Orders' },
  { value: 'payments', label: 'Payments' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'messages', label: 'Messages' },
  { value: 'customers', label: 'Customers' },
  { value: 'subscription', label: 'Subscription' },
];

export const NOTIFY_FREQUENCIES = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

export const EVENT_TYPES = [
  'ORDER_CREATED',
  'ORDER_PAID',
  'ORDER_FULFILLED',
  'PAYMENT_RECEIVED',
  'PAYMENT_REFUNDED',
  'DELIVERY_BOOKED',
  'DELIVERY_DELIVERED',
  'MESSAGE_RECEIVED',
  'CUSTOMER_CREATED',
];

// ─── Business default model ──────────────────────────────────────

export const DEFAULT_BUSINESS: BusinessSettings = {
  businessName: '',
  description: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  taxRate: 0,
  taxMethod: 'EXCLUSIVE',
  currency: 'NGN',
  currencyFormat: 'symbol',
  language: 'en',
  supportedLanguages: ['en'],
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  email: { enabled: true, events: ['orders', 'payments', 'deliveries'], frequency: 'instant' },
  sms: { enabled: false, events: ['payments'], frequency: 'instant' },
  whatsapp: { enabled: true, events: ['orders', 'payments'], frequency: 'instant' },
  push: { enabled: true, events: ['messages', 'deliveries'], frequency: 'instant' },
  quietHours: { start: '22:00', end: '08:00' },
  sound: true,
  badge: true,
};

// ─── Form validation schemas ─────────────────────────────────────

export const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(120),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number'),
});

export const businessProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  address: z.string().max(240).optional().or(z.literal('')),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email'),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  taxId: z.string().max(60).optional().or(z.literal('')),
  taxRate: z.coerce.number().min(0, 'Tax rate must be ≥ 0').max(100, 'Tax rate must be ≤ 100'),
  taxMethod: z.enum(['INCLUSIVE', 'EXCLUSIVE']),
  currency: z.string().min(1),
  currencyFormat: z.string().min(1),
  language: z.string().min(1),
  supportedLanguages: z.array(z.string()).min(1, 'Select at least one language'),
  timezone: z.string().min(1),
  dateFormat: z.string().min(1),
  timeFormat: z.enum(['12h', '24h']),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const sellerProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(120),
  businessCategory: z.string().max(60).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
  state: z.string().max(60).optional().or(z.literal('')),
  address: z.string().max(240).optional().or(z.literal('')),
  country: z.string().min(1),
});

export const paymentMethodSchema = z.object({
  type: z.enum(['BANK_ACCOUNT', 'MOBILE_MONEY', 'USSD']),
  providerName: z.string().min(2, 'Provider name is required').max(60),
  accountName: z.string().min(2, 'Account name is required').max(120),
  accountNumber: z.string().regex(/^\d{6,20}$/, 'Account number must be 6–20 digits'),
  bankCode: z.string().max(12).optional().or(z.literal('')),
  isDefault: z.boolean().default(false),
});

export const providerLinkSchema = z.object({
  providerCode: z.enum(['GIG', 'KWIK', 'SENDY']),
  accountRef: z.string().max(120).optional().or(z.literal('')),
  credentials: z.string().min(8, 'Credentials must be at least 8 characters').max(2000),
  isDefault: z.boolean().default(false),
});

export const webhookSchema = z.object({
  url: z.string().url('Enter a valid webhook URL').max(500),
  events: z.array(z.string()).min(1, 'Select at least one event'),
});

export const waConnectSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid WhatsApp number'),
  displayName: z.string().max(120).optional().or(z.literal('')),
});

export const aiTestSchema = z.object({
  message: z.string().min(1, 'Enter a message to test').max(2000),
});
