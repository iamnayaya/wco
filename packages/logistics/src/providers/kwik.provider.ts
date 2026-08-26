import type {
  BookingInput,
  BookingResult,
  DeliveryQuote,
  LogisticsProvider,
  QuoteInput,
  TrackingUpdate,
} from '../logistics-provider.interface';

/**
 * KwikProvider — on-demand last-mile delivery (Lagos/Abuja), Uber-style.
 * Real-time pricing; riders accept within minutes.
 */
export class KwikProvider implements LogisticsProvider {
  readonly carrier = 'KWIK' as const;

  constructor(
    private readonly accessToken: string | undefined,
    private readonly baseUrl: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.baseUrl);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) throw new Error('Kwik provider not configured');
  }

  async quote(input: QuoteInput): Promise<DeliveryQuote> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v1/get-quote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_address: input.pickupAddress,
        dropoff_address: input.dropoffAddress,
        package_weight: input.packageWeightKg ?? 1,
      }),
    });
    if (!response.ok) throw new Error(`Kwik quote failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { total?: number; eta_minutes?: number } };
    return {
      quoteId: `kwik-${Date.now()}`,
      carrier: 'KWIK',
      fee: json.data?.total ?? 2800,
      currency: 'NGN',
      etaMinutes: json.data?.eta_minutes ?? 90,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    };
  }

  async book(input: BookingInput): Promise<BookingResult> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v1/create-delivery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: input.clientReference,
        pickup_address: input.pickupAddress,
        dropoff_address: input.dropoffAddress,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        package_description: input.packageDescription,
        payment_mode: input.codAmount ? 'cash' : 'prepaid',
        cod_amount: input.codAmount ?? 0,
      }),
    });
    if (!response.ok) throw new Error(`Kwik booking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { job_id?: number; tracking_code?: string } };
    return {
      bookingId: String(json.data?.job_id ?? ''),
      trackingCode: json.data?.tracking_code ?? '',
      status: 'BOOKED',
    };
  }

  async track(trackingCode: string): Promise<TrackingUpdate> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/${encodeURIComponent(trackingCode)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error(`Kwik tracking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { data?: { status?: string } };
    const map: Record<string, TrackingUpdate['status']> = {
      pending: 'BOOKED',
      accepted: 'PICKED_UP',
      picked_up: 'IN_TRANSIT',
      arrived: 'IN_TRANSIT',
      completed: 'DELIVERED',
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
