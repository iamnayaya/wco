import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  RefundResult,
  VerifyResult,
} from '../payment-provider.interface';

const BASE_URL = process.env.FLW_BASE_URL ?? 'https://api.flutterwave.com/v3';

/**
 * FlutterwaveProvider — pan-African PSP (strong for Ghana/Kenya corridors).
 * API docs: https://developer.flutterwave.com/docs
 */
export class FlutterwaveProvider implements PaymentProvider {
  readonly name = 'FLUTTERWAVE';

  constructor(private readonly secretKey: string) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' };
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const response = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency,
        redirect_url: process.env.FLW_REDIRECT_URL,
        customer: { name: input.customerName, phonenumber: input.customerPhone },
        meta: input.metadata,
      }),
    });
    if (!response.ok) throw new Error(`Flutterwave initialize failed: HTTP ${response.status}`);

    const json = (await response.json()) as { status: string; data: { link: string } };
    if (json.status !== 'success') throw new Error('Flutterwave initialize rejected');
    return { checkoutUrl: json.data.link, providerReference: input.reference };
  }

  async verify(providerReference: string): Promise<VerifyResult> {
    const response = await fetch(`${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerReference)}`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Flutterwave verify failed: HTTP ${response.status}`);

    const json = (await response.json()) as {
      data: { status: string; amount_settled?: number; amount: number; currency: string; created_at?: string; processor_response?: string };
    };

    const statusMap: Record<string, VerifyResult['status']> = {
      successful: 'SUCCEEDED',
      failed: 'FAILED',
      pending: 'PENDING',
      cancelled: 'ABANDONED',
    };

    return {
      status: statusMap[json.data.status] ?? 'PENDING',
      amountPaid: json.data.amount,
      currency: json.data.currency,
      paidAt: json.data.created_at ? new Date(json.data.created_at) : undefined,
      failureReason: json.data.processor_response,
    };
  }

  async refund(providerReference: string, _amount?: number): Promise<RefundResult> {
    const response = await fetch(`${BASE_URL}/transactions/${encodeURIComponent(providerReference)}/refund`, {
      method: 'POST',
      headers: this.headers(),
    });
    return { accepted: response.ok };
  }

  /**
   * Flutterwave signs webhooks with verif-hash header (static secret shared
   * via dashboard). Compared with constant-time equality.
   */
  verifyWebhookSignature(_rawBody: Buffer, signature: string): boolean {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!secret || !signature) return false;
    const a = Buffer.from(secret);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

/** Legacy v2-style payload integrity check (sha256(payload + secretKey)). */
export function verifyLegacyPayloadIntegrity(rawPayload: object, secretKey: string, expectedSig: string): boolean {
  const computed = createHash('sha256').update(JSON.stringify(rawPayload) + secretKey).digest('hex');
  return computed === expectedSig;
}
