import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryAddressController } from './delivery-address.controller.js';
import {
  deliveryAddressIdParams,
  createDeliveryAddressSchema,
  updateDeliveryAddressSchema,
  listDeliveryAddressesQuerySchema,
} from './delivery-address.dto.js';

export const deliveryAddressesRouter: Router = Router();
deliveryAddressesRouter.use(authenticate(), tenantScope());

deliveryAddressesRouter.get(
  '/',
  validate({ query: listDeliveryAddressesQuerySchema }),
  asyncHandler(deliveryAddressController.list),
);

deliveryAddressesRouter.get(
  '/default',
  asyncHandler(deliveryAddressController.getDefault),
);

deliveryAddressesRouter.get(
  '/:id',
  validate({ params: deliveryAddressIdParams }),
  asyncHandler(deliveryAddressController.getById),
);

deliveryAddressesRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createDeliveryAddressSchema }),
  asyncHandler(deliveryAddressController.create),
);

deliveryAddressesRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryAddressIdParams, body: updateDeliveryAddressSchema }),
  asyncHandler(deliveryAddressController.update),
);

deliveryAddressesRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryAddressIdParams }),
  asyncHandler(deliveryAddressController.remove),
);
