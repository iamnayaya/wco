/**
 * LogisticsProvider — contract for delivery carriers (GIG, Kwik, Sendy).
 * Quotes are ephemeral (TTL ~15 min); bookings are idempotent by clientRef.
 */
export interface QuoteInput {
  readonly pickupAddress: string;
  readonly dropoffAddress: string;
  readonly recipientPhone: string;
  readonly packageName: string;
  readonly packageWeightKg?: number;
}

export interface DeliveryQuote {
  readonly quoteId: string;
  readonly carrier: 'GIG' | 'KWIK' | 'SENDY';
  readonly fee: number;
  readonly currency: string;
  readonly etaMinutes: number;
  readonly expiresAt: Date;
}

export interface BookingInput {
  readonly clientReference: string;
  readonly quoteId?: string;
  readonly pickupAddress: string;
  readonly dropoffAddress: string;
  readonly recipientPhone: string;
  readonly recipientName?: string;
  readonly packageDescription: string;
  readonly codAmount?: number; // cash-on-delivery amount to collect
}

export interface BookingResult {
  readonly bookingId: string;
  readonly trackingCode: string;
  readonly status: 'BOOKED' | 'PENDING';
  readonly etaMinutes?: number;
}

export type CarrierTrackingStatus =
  | 'BOOKED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

export interface TrackingUpdate {
  readonly trackingCode: string;
  readonly status: CarrierTrackingStatus;
  readonly occurredAt: Date;
  readonly location?: string;
  readonly note?: string;
}

export interface LogisticsProvider {
  readonly carrier: 'GIG' | 'KWIK' | 'SENDY';
  isConfigured(): boolean;
  quote(input: QuoteInput): Promise<DeliveryQuote>;
  book(input: BookingInput): Promise<BookingResult>;
  track(trackingCode: string): Promise<TrackingUpdate>;
}
