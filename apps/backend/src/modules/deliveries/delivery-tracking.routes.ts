import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryTrackingController } from './delivery-tracking.controller.js';
import { deliveryIdParams, trackingQuerySchema, createTrackingEventSchema } from './delivery.dto.js';

export const deliveryTrackingRouter: Router = Router({ mergeParams: true });
deliveryTrackingRouter.use(authenticate(), tenantScope());

deliveryTrackingRouter.get(
  '/',
  validate({ params: deliveryIdParams, query: trackingQuerySchema }),
  asyncHandler(deliveryTrackingController.listByDelivery),
);

deliveryTrackingRouter.get(
  '/status',
  validate({ params: deliveryIdParams }),
  asyncHandler(deliveryTrackingController.getCurrentStatus),
);

deliveryTrackingRouter.post(
  '/',
  requirePermission('order:write'),
  validate({ params: deliveryIdParams, body: createTrackingEventSchema }),
  asyncHandler(deliveryTrackingController.create),
);
