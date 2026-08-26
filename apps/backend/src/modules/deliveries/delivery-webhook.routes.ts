import { Router } from 'express';

import { logger } from '../../lib/logger.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { deliveryService } from './services/delivery.service.js';

/**
 * Delivery webhook routes — public endpoints for carrier callbacks.
 * No auth; carrier-specific HMAC verification is handled per-route.
 */

export const deliveryWebhookRouter: Router = Router();

/**
 * GIG Logistics webhook endpoint.
 * Receives tracking status updates from GIG API.
 */
deliveryWebhookRouter.post(
  '/gig',
  asyncHandler(async (req, res) => {
    // TODO: Verify GIG webhook signature using HMAC-SHA256
    const payload = req.body;
    logger.info('delivery-webhook.gig', { payload });

    const update = {
      trackingCode: payload.tracking_code || payload.waybill_number,
      status: mapGigStatus(payload.status),
      location: payload.current_location,
      note: payload.description,
      occurredAt: payload.status_date ? new Date(payload.status_date) : undefined,
    };

    if (update.trackingCode) {
      await deliveryService.handleTrackingUpdate('GIG', update);
    }

    sendSuccess(res, { received: true });
  }),
);

/**
 * Kwik Delivery webhook endpoint.
 */
deliveryWebhookRouter.post(
  '/kwik',
  asyncHandler(async (req, res) => {
    // TODO: Verify Kwik webhook signature
    const payload = req.body;
    logger.info('delivery-webhook.kwik', { payload });

    const update = {
      trackingCode: payload.order_id || payload.tracking_code,
      status: mapKwikStatus(payload.status),
      location: payload.location,
      note: payload.note,
      occurredAt: payload.timestamp ? new Date(payload.timestamp) : undefined,
    };

    if (update.trackingCode) {
      await deliveryService.handleTrackingUpdate('KWIK', update);
    }

    sendSuccess(res, { received: true });
  }),
);

/**
 * Sendy webhook endpoint.
 */
deliveryWebhookRouter.post(
  '/sendy',
  asyncHandler(async (req, res) => {
    // TODO: Verify Sendy webhook signature
    const payload = req.body;
    logger.info('delivery-webhook.sendy', { payload });

    const update = {
      trackingCode: payload.order_id || payload.tracking_code,
      status: mapSendyStatus(payload.status),
      location: payload.current_location,
      note: payload.description,
      occurredAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };

    if (update.trackingCode) {
      await deliveryService.handleTrackingUpdate('SENDY', update);
    }

    sendSuccess(res, { received: true });
  }),
);

// --- Status mappers (carrier-specific → WCO enum) ---

function mapGigStatus(status: string): 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED' {
  const map: Record<string, 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED'> = {
    'Order Placed': 'BOOKED',
    'Picked Up': 'PICKED_UP',
    'In Transit': 'IN_TRANSIT',
    'Delivered': 'DELIVERED',
    'Failed': 'FAILED',
    'Cancelled': 'CANCELLED',
    'Returned': 'FAILED',
  };
  return map[status] ?? 'IN_TRANSIT';
}

function mapKwikStatus(status: string): 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED' {
  const map: Record<string, 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED'> = {
    'created': 'BOOKED',
    'assigned': 'BOOKED',
    'picked_up': 'PICKED_UP',
    'in_transit': 'IN_TRANSIT',
    'delivered': 'DELIVERED',
    'failed': 'FAILED',
    'cancelled': 'CANCELLED',
  };
  return map[status?.toLowerCase()] ?? 'IN_TRANSIT';
}

function mapSendyStatus(status: string): 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED' {
  const map: Record<string, 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED'> = {
    'Placed': 'BOOKED',
    'Picked': 'PICKED_UP',
    'In-Transit': 'IN_TRANSIT',
    'Delivered': 'DELIVERED',
    'Failed': 'FAILED',
    'Cancelled': 'CANCELLED',
    'Returned': 'FAILED',
  };
  return map[status] ?? 'IN_TRANSIT';
}
