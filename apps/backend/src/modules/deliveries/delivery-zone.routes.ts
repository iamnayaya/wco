import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryZoneController } from './delivery-zone.controller.js';
import {
  deliveryZoneIdParams,
  createDeliveryZoneSchema,
  updateDeliveryZoneSchema,
  listDeliveryZonesQuerySchema,
  checkAddressInZoneSchema,
} from './delivery-zone.dto.js';

export const deliveryZonesRouter: Router = Router();
deliveryZonesRouter.use(authenticate(), tenantScope());

deliveryZonesRouter.get(
  '/',
  validate({ query: listDeliveryZonesQuerySchema }),
  asyncHandler(deliveryZoneController.list),
);

deliveryZonesRouter.get(
  '/:id',
  validate({ params: deliveryZoneIdParams }),
  asyncHandler(deliveryZoneController.getById),
);

deliveryZonesRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createDeliveryZoneSchema }),
  asyncHandler(deliveryZoneController.create),
);

deliveryZonesRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryZoneIdParams, body: updateDeliveryZoneSchema }),
  asyncHandler(deliveryZoneController.update),
);

deliveryZonesRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryZoneIdParams }),
  asyncHandler(deliveryZoneController.remove),
);

deliveryZonesRouter.post(
  '/:id/check-address',
  requirePermission('store:write'),
  validate({ params: deliveryZoneIdParams, body: checkAddressInZoneSchema }),
  asyncHandler(deliveryZoneController.checkAddressInZone),
);
