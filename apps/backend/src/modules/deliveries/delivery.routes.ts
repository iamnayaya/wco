import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryController } from './delivery.controller.js';
import {
  deliveryIdParams,
  orderIdParams,
  createDeliverySchema,
  updateDeliverySchema,
  listDeliveriesQuerySchema,
  calculateCostSchema,
  cancelDeliverySchema,
  rateDeliverySchema,
  deliveryStatsQuerySchema,
} from './delivery.dto.js';

export const deliveriesRouter: Router = Router();
deliveriesRouter.use(authenticate(), tenantScope());

// --- list ---
deliveriesRouter.get(
  '/',
  validate({ query: listDeliveriesQuerySchema }),
  asyncHandler(deliveryController.list),
);

// --- stats ---
deliveriesRouter.get(
  '/stats',
  validate({ query: deliveryStatsQuerySchema }),
  asyncHandler(deliveryController.stats),
);

// --- carriers ---
deliveriesRouter.get(
  '/carriers',
  asyncHandler(deliveryController.listCarriers),
);

// --- calculate cost ---
deliveriesRouter.post(
  '/calculate-cost',
  validate({ body: calculateCostSchema }),
  asyncHandler(deliveryController.calculateCost),
);

// --- get by order ---
deliveriesRouter.get(
  '/order/:orderId',
  validate({ params: orderIdParams }),
  asyncHandler(deliveryController.getByOrderId),
);

// --- get by ID ---
deliveriesRouter.get(
  '/:id',
  validate({ params: deliveryIdParams }),
  asyncHandler(deliveryController.getById),
);

// --- create ---
deliveriesRouter.post(
  '/',
  requirePermission('order:write'),
  validate({ body: createDeliverySchema }),
  asyncHandler(deliveryController.create),
);

// --- update ---
deliveriesRouter.patch(
  '/:id',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams, body: updateDeliverySchema }),
  asyncHandler(deliveryController.update),
);

// --- delete ---
deliveriesRouter.delete(
  '/:id',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams }),
  asyncHandler(deliveryController.remove),
);

// --- book ---
deliveriesRouter.post(
  '/:id/book',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams }),
  asyncHandler(deliveryController.book),
);

// --- cancel ---
deliveriesRouter.post(
  '/:id/cancel',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams, body: cancelDeliverySchema }),
  asyncHandler(deliveryController.cancel),
);

// --- track ---
deliveriesRouter.get(
  '/:id/track',
  validate({ params: deliveryIdParams }),
  asyncHandler(deliveryController.track),
);

// --- rate ---
deliveriesRouter.post(
  '/:id/rate',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams, body: rateDeliverySchema }),
  asyncHandler(deliveryController.rate),
);
