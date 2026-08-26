import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { multerErrorHandler, uploadSingleCsv } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  aiController,
  cancellationsController,
  itemsController,
  notesController,
  ordersController,
  refundsController,
  statusController,
  timeline,
} from './orders.controller.js';
import {
  cancellationBodySchema,
  cancellationParams,
  createOrderSchema,
  idParams,
  itemParams,
  itemUpdateSchema,
  listOrdersQuerySchema,
  listOrdersV2QuerySchema,
  noteBodySchema,
  noteParams,
  noteUpdateSchema,
  orderTransitionSchema,
  refundBodySchema,
  refundParams,
  refundUpdateSchema,
  updateOrderSchema,
} from './orders.dto.js';

/**
 * Orders routes - creation (idempotent via Idempotency-Key), the status
 * state-machine, and the sub-resource surface (items, status history, notes,
 * refunds, cancellations), plus stats / search / CSV import-export /
 * WhatsApp sync / AI endpoints.
 *
 * Mount order matters: literal segments (/search, /export, /import, /stats,
 * /sync-whatsapp) are registered BEFORE the /:id wildcard. Reads are open to
 * any authenticated team member; mutations require `order:write` (RBAC).
 * Refund/cancellation PROCESSING moves real money or stock - OWNER/ADMIN only.
 */
export const ordersRouter: Router = Router();
ordersRouter.use(authenticate(), tenantScope());

// --- collection-level ---------------------------------------------------------

ordersRouter.get('/', validate({ query: listOrdersQuerySchema }), asyncHandler(ordersController.listLegacy));

ordersRouter.post(
  '/',
  requirePermission('order:write'),
  idempotency(),
  validate({ body: createOrderSchema }),
  asyncHandler(ordersController.create),
);

// v2 offset listing (page/pageSize/filters/sort). Mounted at /v2 to keep the
// legacy cursor contract on '/' stable for shipped clients.
ordersRouter.get('/v2', validate({ query: listOrdersV2QuerySchema }), asyncHandler(ordersController.listV2));

ordersRouter.get(
  '/search',
  validate({ query: listOrdersV2QuerySchema }),
  asyncHandler(ordersController.search),
);

ordersRouter.get('/export', asyncHandler(ordersController.exportCsv));

ordersRouter.post(
  '/import',
  requirePermission('order:write'),
  uploadSingleCsv('file'),
  multerErrorHandler,
  asyncHandler(ordersController.importCsv),
);

ordersRouter.get('/stats', asyncHandler(ordersController.stats));

ordersRouter.post('/sync-whatsapp', requirePermission('order:write'), asyncHandler(ordersController.syncWhatsApp));

// --- item-level ----------------------------------------------------------------

ordersRouter.get('/:id', validate({ params: idParams }), asyncHandler(ordersController.get));

ordersRouter.patch(
  '/:id',
  requirePermission('order:write'),
  validate({ params: idParams, body: updateOrderSchema }),
  asyncHandler(ordersController.update),
);

// Legacy POST kept for shipped clients; PUT is the documented contract.
ordersRouter.post(
  '/:id/status',
  requirePermission('order:write'),
  validate({ params: idParams, body: orderTransitionSchema }),
  asyncHandler(ordersController.transition),
);

ordersRouter.put(
  '/:id/status',
  requirePermission('order:write'),
  validate({ params: idParams, body: orderTransitionSchema }),
  asyncHandler(ordersController.transition),
);

ordersRouter.get('/:id/status-history', validate({ params: idParams }), asyncHandler(statusController.history));

ordersRouter.get('/:id/current-status', validate({ params: idParams }), asyncHandler(statusController.current));

ordersRouter.get('/:id/timeline', validate({ params: idParams }), asyncHandler(timeline));

// --- AI -----------------------------------------------------------------------------

ordersRouter.post(
  '/:id/ai/predict-fulfillment',
  requirePermission('order:write'),
  validate({ params: idParams }),
  asyncHandler(aiController.predictFulfillment),
);

ordersRouter.post(
  '/:id/ai/fraud-check',
  requirePermission('order:write'),
  validate({ params: idParams }),
  asyncHandler(aiController.checkFraud),
);

// --- line items -------------------------------------------------------------------------

ordersRouter.get('/:id/items', validate({ params: idParams }), asyncHandler(itemsController.list));

ordersRouter.get('/:id/items/:itemId', validate({ params: itemParams }), asyncHandler(itemsController.get));

ordersRouter.put(
  '/:id/items/:itemId',
  requirePermission('order:write'),
  validate({ params: itemParams, body: itemUpdateSchema }),
  asyncHandler(itemsController.update),
);

ordersRouter.delete(
  '/:id/items/:itemId',
  requirePermission('order:write'),
  validate({ params: itemParams }),
  asyncHandler(itemsController.remove),
);

// --- notes --------------------------------------------------------------------------------

ordersRouter.get('/:id/notes', validate({ params: idParams }), asyncHandler(notesController.list));

ordersRouter.post(
  '/:id/notes',
  requirePermission('order:write'),
  validate({ params: idParams, body: noteBodySchema }),
  asyncHandler(notesController.create),
);

ordersRouter.get('/:id/notes/:noteId', validate({ params: noteParams }), asyncHandler(notesController.get));

ordersRouter.put(
  '/:id/notes/:noteId',
  requirePermission('order:write'),
  validate({ params: noteParams, body: noteUpdateSchema }),
  asyncHandler(notesController.update),
);

ordersRouter.delete(
  '/:id/notes/:noteId',
  requirePermission('order:write'),
  validate({ params: noteParams }),
  asyncHandler(notesController.remove),
);

// --- refunds (money movement: process is OWNER/ADMIN only) ----------------------------------

ordersRouter.get('/:id/refunds', validate({ params: idParams }), asyncHandler(refundsController.list));

ordersRouter.post(
  '/:id/refunds',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: idParams, body: refundBodySchema }),
  asyncHandler(refundsController.create),
);

ordersRouter.get(
  '/:id/refunds/:refundId',
  validate({ params: refundParams }),
  asyncHandler(refundsController.get),
);

ordersRouter.put(
  '/:id/refunds/:refundId',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: refundParams, body: refundUpdateSchema }),
  asyncHandler(refundsController.update),
);

ordersRouter.delete(
  '/:id/refunds/:refundId',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: refundParams }),
  asyncHandler(refundsController.remove),
);

ordersRouter.post(
  '/:id/refunds/:refundId/process',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: refundParams }),
  asyncHandler(refundsController.process),
);

// --- cancellations ------------------------------------------------------------------------------

ordersRouter.get('/:id/cancellations', validate({ params: idParams }), asyncHandler(cancellationsController.list));

ordersRouter.post(
  '/:id/cancellations',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: idParams, body: cancellationBodySchema }),
  asyncHandler(cancellationsController.create),
);

ordersRouter.get(
  '/:id/cancellations/:cancellationId',
  validate({ params: cancellationParams }),
  asyncHandler(cancellationsController.get),
);

ordersRouter.patch(
  '/:id/cancellations/:cancellationId',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: cancellationParams, body: cancellationBodySchema }),
  asyncHandler(cancellationsController.updateReason),
);

ordersRouter.delete(
  '/:id/cancellations/:cancellationId',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: cancellationParams }),
  asyncHandler(cancellationsController.remove),
);

ordersRouter.post(
  '/:id/cancellations/:cancellationId/process',
  requireRole('OWNER', 'ADMIN'),
  validate({ params: cancellationParams }),
  asyncHandler(cancellationsController.process),
);
