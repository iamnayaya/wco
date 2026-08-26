/**
 * Tracking normalization — carrier webhooks speak different dialects;
 * the platform speaks exactly one. Everything funnels through
 * `normalizeTrackingStatus`, and unknown statuses fail safe to IN_TRANSIT
 * (visible, never silently dropped).
 */

export type WcoShipmentStatus =
  | 'BOOKED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

export interface NormalizedTrackingUpdate {
  trackingCode: string;
  status: WcoShipmentStatus;
  /** Human-readable event label, e.g. "Package picked up in Lagos" */
  label: string;
  occurredAt: Date;
}

const STATUS_MAP: Record<string, WcoShipmentStatus> = {
  // GIG
  PICKED_UP: 'PICKED_UP',
  'IN TRANSIT': 'IN_TRANSIT',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  // Kwik
  EN_ROUTE: 'IN_TRANSIT',
  ARRIVED_AT_DESTINATION: 'IN_TRANSIT',
  COMPLETED: 'DELIVERED',
  // Sendy
  ACCEPTED: 'PICKED_UP',
  TRIP_STARTED: 'IN_TRANSIT',
  TRIP_COMPLETED: 'DELIVERED',
  // Shared failure vocabulary
  FAILED: 'FAILED',
  'DELIVERY FAILED': 'FAILED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'FAILED',
};

export function normalizeTrackingStatus(rawStatus: string): WcoShipmentStatus {
  const key = rawStatus.trim().toUpperCase();
  return STATUS_MAP[key] ?? 'IN_TRANSIT';
}

/** Public tracking URL shown to customers inside WhatsApp messages. */
export function publicTrackingUrl(baseUrl: string, trackingCode: string): string {
  const clean = baseUrl.replace(/\/+$/, '');
  return `${clean}/track/${encodeURIComponent(trackingCode)}`;
}
