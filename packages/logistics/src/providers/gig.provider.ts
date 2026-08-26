import type {
  BookingInput,
  BookingResult,
  DeliveryQuote,
  LogisticsProvider,
  QuoteInput,
  TrackingUpdate,
} from '../logistics-provider.interface';

/**
 * GIGProvider — GIG Logistics (nationwide Nigerian parcel network).
 * Terminal-to-terminal model: merchant drops at nearest GIG office.
 */
export class GIGProvider implements LogisticsProvider {
  readonly carrier = 'GIG' as const;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) throw new Error('GIG provider not configured');
  }

  async quote(input: QuoteInput): Promise<DeliveryQuote> {
    this.assertConfigured();
    // GIG exposes a rate calculator per route; terminal pricing is flat-zone.
    const zoneFee = this.estimateZoneFee(input.pickupAddress, input.dropoffAddress);
    return {
      quoteId: `gig-quote-${Date.now()}`,
      carrier: 'GIG',
      fee: zoneFee.fee,
      currency: 'NGN',
      etaMinutes: zoneFee.hours * 60,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    };
  }

  async book(input: BookingInput): Promise<BookingResult> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/shipments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: input.clientReference,
        pickup_address: input.pickupAddress,
        delivery_address: input.dropoffAddress,
        recipient_phone: input.recipientPhone,
        description: input.packageDescription,
        ...(input.codAmount ? { cod_amount: Math.round(input.codAmount * 100) } : {}),
      }),
    });
    if (!response.ok) throw new Error(`GIG booking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { waybill_number?: string; shipment_id?: string };
    return {
      bookingId: json.shipment_id ?? input.clientReference,
      trackingCode: json.waybill_number ?? '',
      status: 'BOOKED',
    };
  }

  async track(trackingCode: string): Promise<TrackingUpdate> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/shipments/${encodeURIComponent(trackingCode)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`GIG tracking failed: HTTP ${response.status}`);

    const json = (await response.json()) as { status?: string };
    return {
      trackingCode,
      status: this.mapStatus(json.status),
      occurredAt: new Date(),
    };
  }

  private estimateZoneFee(pickup: string, dropoff: string): { fee: number; hours: number } {
    const lagos = /lagos/i;
    if (lagos.test(pickup) && lagos.test(dropoff)) return { fee: 3500, hours: 24 };
    if (lagos.test(pickup) !== lagos.test(dropoff)) return { fee: 6500, hours: 48 };
    return { fee: 5500, hours: 72 };
  }

  private mapStatus(raw?: string): TrackingUpdate['status'] {
    switch ((raw ?? '').toUpperCase()) {
      case 'PICKED_UP':
      case 'DEPARTED':
        return 'IN_TRANSIT';
      case 'DELIVERED':
        return 'DELIVERED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'BOOKED';
    }
  }
}
