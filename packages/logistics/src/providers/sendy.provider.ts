import type {
  BookingInput,
  BookingResult,
  DeliveryQuote,
  LogisticsProvider,
  QuoteInput,
  TrackingUpdate,
} from '../logistics-provider.interface';

/**
 * SendyProvider — Kenya/Ghana on-demand logistics (boda + van fleet).
 */
export class SendyProvider implements LogisticsProvider {
  readonly carrier = 'SENDY' as const;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) throw new Error('Sendy provider not configured');
  }

  async quote(input: QuoteInput): Promise<DeliveryQuote> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v2/quotes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_location: input.pickupAddress,
        destination: input.dropoffAddress,
        package_size: (input.packageWeightKg ?? 1) > 5 ? 'medium' : 'small',
      }),
    });
    if (!response.ok) throw new Error(`Sendy quote failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { amount?: number; eta_minutes?: number; quote_id?: string } };
    return {
      quoteId: json.data?.quote_id ?? `sendy-${Date.now()}`,
      carrier: 'SENDY',
      fee: json.data?.amount ?? 450,
      currency: process.env.SENDY_CURRENCY ?? 'KES',
      etaMinutes: json.data?.eta_minutes ?? 60,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    };
  }

  async book(input: BookingInput): Promise<BookingResult> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v2/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: input.clientReference,
        pickup_location: input.pickupAddress,
        destination: input.dropoffAddress,
        recipient_phone: input.recipientPhone,
        description: input.packageDescription,
        cod_amount: input.codAmount ?? 0,
      }),
    });
    if (!response.ok) throw new Error(`Sendy booking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { request_id?: string; tracking_code?: string } };
    return {
      bookingId: json.data?.request_id ?? '',
      trackingCode: json.data?.tracking_code ?? '',
      status: 'BOOKED',
    };
  }

  async track(trackingCode: string): Promise<TrackingUpdate> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v2/requests/${encodeURIComponent(trackingCode)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`Sendy tracking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { status?: string } };
    const map: Record<string, TrackingUpdate['status']> = {
      accepted: 'PICKED_UP',
      picked_up: 'IN_TRANSIT',
      enroute: 'IN_TRANSIT',
      delivered: 'DELIVERED',
      failed: 'FAILED',
      cancelled: 'CANCELLED',
    };
    return {
      trackingCode,
      status: map[(json.data?.status ?? '').toLowerCase()] ?? 'BOOKED',
      occurredAt: new Date(),
    };
  }
}
