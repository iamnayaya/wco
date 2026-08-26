import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IngestService } from '../../services/ingest.service';

/**
 * Logistics webhook routes — carrier status callbacks.
 * Carriers (GIG/Kwik/Sendy) have heterogeneous callback shapes; each is
 * normalized to shipment.* domain events with the WCO tracking code.
 */
export function registerLogisticsRoutes(app: FastifyInstance, ingest: IngestService): void {
  const register = (
    path: string,
    extract: (payload: Record<string, unknown>) => {
      trackingCode: string;
      status: string;
      location?: string;
      note?: string;
    },
  ) => {
    app.post(path, async (request: FastifyRequest, reply: FastifyReply) => {
      // Carrier callbacks arrive behind Cloudflare + shared-token auth
      if (request.headers['x-wco-carrier-token'] !== process.env.CARRIER_WEBHOOK_TOKEN) {
        return reply.code(401).send({ ok: false });
      }
      const payload = request.body as Record<string, unknown>;
      const event = extract(payload);
      if (!event.trackingCode || !event.status) {
        return reply.code(400).send({ ok: false });
      }

      const fresh = await ingest.acquireDedupeKey(`lgx:${event.trackingCode}:${event.status}`);
      if (!fresh) return reply.code(200).send({ duplicate: true });

      await ingest.publish(`shipment.${event.status.toLowerCase()}`, event);
      return reply.code(200).send({ received: true });
    });
  };

  register('/webhooks/gig', (payload) => ({
    trackingCode: String(payload.waybill_number ?? payload['waybillNo'] ?? ''),
    status: mapStatus(String(payload.status_code ?? payload.status ?? '')),
    location: payload.current_location ? String(payload.current_location) : undefined,
  }));

  register('/webhooks/kwik', (payload) => ({
    trackingCode: String(payload.tracking_id ?? ''),
    status: mapStatus(String(payload.status ?? '')),
    note: payload.reason ? String(payload.reason) : undefined,
  }));

  register('/webhooks/sendy', (payload) => ({
    trackingCode: String(payload.tracking_code ?? payload.order_id ?? ''),
    status: mapStatus(String(payload.state ?? '')),
    location: payload.location ? String(payload.location) : undefined,
  }));
}

/** Normalize carrier-specific statuses to ShipmentStatus vocabulary. */
function mapStatus(raw: string): string {
  const s = raw.toUpperCase();
  if (/(PICKED|COLLECTED|PICKUP)/.test(s)) return 'PICKED_UP';
  if (/(TRANSIT|ENROUTE|ON_THE_WAY|DISPATCH)/.test(s)) return 'IN_TRANSIT';
  if (/(DELIVER|COMPLETED|SUCCESS)/.test(s)) return 'DELIVERED';
  if (/(FAIL|EXCEPTION|LOST|DAMAGED)/.test(s)) return 'FAILED';
  if (/(CANCEL|RETURN)/.test(s)) return 'CANCELLED';
  return 'BOOKED';
}
