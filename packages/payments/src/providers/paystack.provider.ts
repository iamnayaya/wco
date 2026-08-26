import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  RefundResult,
  VerifyResult,
} from '../payment-provider.interface';

const BASE_URL = process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co';

/**
 * PaystackProvider — Nigeria/Ghana primary PSP.
 * API docs: https://paystack.com/docs/api/
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = 'PAYSTACK';

  constructor(private readonly secretKey: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const response = await fetch(`${BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        reference: input.reference,
        amount: Math.round(input.amount * 100), // kobo
        currency: input.currency,
        email: input.email ?? `${input.customerPhone}@whatsapp.wco.app`,
        metadata: { ...input.metadata, customer_phone: input.customerPhone },
      }),
    });

    if (!response.ok) {
      throw new Error(`Paystack initialize failed: HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data: { authorization_url: string; reference: string } };
    return { checkoutUrl: json.data.authorization_url, providerReference: json.data.reference };
  }

  async verify(providerReference: string): Promise<VerifyResult> {
    const response = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(providerReference)}`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Paystack verify failed: HTTP ${response.status}`);

    const { data } = (await response.json()) as {
      data: { status: string; amount: number; fees?: number; currency: string; paid_at?: string; gateway_response?: string };
    };

    const statusMap: Record<string, VerifyResult['status']> = {
      success: 'SUCCEEDED',
      failed: 'FAILED',
      abandoned: 'ABANDONED',
      ongoing: 'PENDING',
      pending: 'PENDING',
      reversed: 'REFUNDED',
    };

    return {
      status: statusMap[data.status] ?? 'PENDING',
      amountPaid: data.amount / 100,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      fee: data.fees !== undefined ? data.fees / 100 : undefined,
      failureReason: data.gateway_response,
    };
  }

  async refund(providerReference: string, amount?: number): Promise<RefundResult> {
    const response = await fetch(`${BASE_URL}/refund`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        transaction: providerReference,
        ...(amount ? { amount: Math.round(amount * 100) } : {}),
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { status?: boolean };
    return { accepted: Boolean(json.status) && response.ok };
  }

  /** HMAC-SHA512 over the raw request body using the secret key. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!signature) return false;
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  static mapWebhookEvent(payload: { event: string }): VerifyResult['status'] | null {
    switch (payload.event) {
      case 'charge.success':
        return 'SUCCEEDED';
      case 'charge.failed':
        return 'FAILED';
      case 'refund.processed':
        return 'REFUNDED';
      default:
        return null;
    }
  }
}
