import { PaystackProvider } from './providers/paystack.provider';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { OPayProvider } from './providers/opay.provider';
import type { PaymentProvider } from './payment-provider.interface';

export * from './payment-provider.interface';
export * from './webhooks';
export { PaystackProvider } from './providers/paystack.provider';
export { FlutterwaveProvider, verifyLegacyPayloadIntegrity } from './providers/flutterwave.provider';
export { OPayProvider } from './providers/opay.provider';

export type ProviderRegistry = Record<string, PaymentProvider>;

/**
 * Build the configured provider set. Missing credentials simply omit that
 * provider — stores pick from what's enabled per merchant onboarding.
 */
export function buildPaymentProviders(): ProviderRegistry {
  const registry: ProviderRegistry = {};

  if (process.env.PAYSTACK_SECRET_KEY) {
    registry.PAYSTACK = new PaystackProvider(process.env.PAYSTACK_SECRET_KEY);
  }
  if (process.env.FLUTTERWAVE_SECRET_KEY) {
    registry.FLUTTERWAVE = new FlutterwaveProvider(process.env.FLUTTERWAVE_SECRET_KEY);
  }
  if (process.env.OPAY_PRIVATE_KEY && process.env.OPAY_MERCHANT_ID && process.env.OPAY_PUBLIC_KEY) {
    registry.OPAY = new OPayProvider(
      process.env.OPAY_MERCHANT_ID,
      process.env.OPAY_PRIVATE_KEY,
      process.env.OPAY_PUBLIC_KEY,
    );
  }

  return registry;
}
