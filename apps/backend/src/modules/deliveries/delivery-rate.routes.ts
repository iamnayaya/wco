import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryRateController } from './delivery-rate.controller.js';
import {
  deliveryRateIdParams,
  deliveryProviderIdParam,
  createDeliveryRateSchema,
  updateDeliveryRateSchema,
  calculateRateSchema,
} from './delivery-rate.dto.js';

export const deliveryRatesRouter: Router = Router();
deliveryRatesRouter.use(authenticate(), tenantScope());

// --- calculate rate ---
deliveryRatesRouter.post(
  '/calculate',
  validate({ body: calculateRateSchema }),
  asyncHandler(deliveryRateController.calculate),
);

// --- list rates for a provider ---
deliveryRatesRouter.get(
  '/provider/:providerId',
  validate({ params: deliveryProviderIdParam }),
  asyncHandler(deliveryRateController.listByProvider),
);

// --- create rate for a provider ---
deliveryRatesRouter.post(
  '/provider/:providerId',
  requirePermission('store:write'),
  validate({ params: deliveryProviderIdParam, body: createDeliveryRateSchema }),
  asyncHandler(deliveryRateController.create),
);

// --- get rate by ID ---
deliveryRatesRouter.get(
  '/provider/:providerId/:id',
  validate({ params: deliveryRateIdParams }),
  asyncHandler(deliveryRateController.getById),
);

// --- update rate ---
deliveryRatesRouter.patch(
  '/provider/:providerId/:id',
  requirePermission('store:write'),
  validate({ params: deliveryRateIdParams, body: updateDeliveryRateSchema }),
  asyncHandler(deliveryRateController.update),
);

// --- delete rate ---
deliveryRatesRouter.delete(
  '/provider/:providerId/:id',
  requirePermission('store:write'),
  validate({ params: deliveryRateIdParams }),
  asyncHandler(deliveryRateController.remove),
);
