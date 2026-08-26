import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  RefundResult,
  VerifyResult,
} from '../payment-provider.interface';

/**
 * OPayProvider — mobile-money heavy PSP popular with Nigerian informal traders.
 * Docs: https://documentations.opayweb.com/
 */
export class OPayProvider implements PaymentProvider {
  readonly name = 'OPAY';

  constructor(
    private readonly merchantId: string,
    private readonly privateKey: string,
    private readonly publicKey: string,
  ) {}

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.privateKey}`, MerchantId: this.merchantId, 'Content-Type': 'application/json' };
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const response = await fetch('https://cashierapi.opayweb.com/api/v3/transaction/create', {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        reference: input.reference,
        amount: String(Math.round(input.amount * 100)),
        currency: input.currency,
        country: 'NG',
        payMethod: 'bankTransfer',
        userInfo: { userPhone: input.customerPhone, userName: input.customerName },
        callbackUrl: process.env.OPAY_CALLBACK_URL,
      }),
    });
    if (!response.ok) throw new Error(`OPay initialize failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { cashierUrl?: string; orderNo?: string } };
    if (!json.data?.cashierUrl) throw new Error('OPay initialize missing cashierUrl');
    return { checkoutUrl: json.data.cashierUrl, providerReference: json.data.orderNo ?? input.reference };
  }

  async verify(_providerReference: string): Promise<VerifyResult> {
    throw new Error('OPay verify: implement per merchant onboarding (status endpoint varies by product)');
  }

  async refund(_providerReference: string, _amount?: number): Promise<RefundResult> {
    throw new Error('OPay refunds handled via merchant dashboard in current integration');
  }

  /** HMAC-SHA1 over raw body using the private key (per OPay spec). */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha1', this.privateKey).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  getPublicKey(): string {
    return this.publicKey;
  }
}
