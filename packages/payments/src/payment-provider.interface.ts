/**
 * PaymentProvider — the contract every PSP adapter implements.
 *
 * Design rules:
 *  - Amounts cross this boundary in MAJOR units (naira, cedi); adapters
 *    convert to minor units (kobo/pesewa) internally.
 *  - Every method is idempotent-safe: providers may be retried by callers
 *    after timeouts; reference is the idempotency key.
 *  - Webhook signature verification MUST use timing-safe comparison.
 */
export interface InitializePaymentInput {
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
  readonly email?: string;
  readonly customerPhone: string;
  readonly customerName?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  readonly checkoutUrl: string;
  readonly providerReference: string;
}

export type MappedPaymentStatus =
  | 'INITIALIZED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'ABANDONED';

export interface VerifyResult {
  readonly status: MappedPaymentStatus;
  readonly amountPaid: number;
  readonly currency: string;
  readonly paidAt?: Date;
  readonly fee?: number;
  readonly failureReason?: string;
}

export interface RefundResult {
  readonly accepted: boolean;
  readonly refundReference?: string;
}

export interface PaymentProvider {
  readonly name: string;

  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verify(providerReference: string): Promise<VerifyResult>;
  refund(providerReference: string, amount?: number): Promise<RefundResult>;

  /**
   * Verify a webhook payload signature. `rawBody` must be the exact bytes
   * received — re-serialization breaks HMAC.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
