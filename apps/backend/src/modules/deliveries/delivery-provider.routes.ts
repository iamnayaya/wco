import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryProviderController } from './delivery-provider.controller.js';
import {
  createDeliveryProviderSchema,
  updateDeliveryProviderSchema,
  deliveryProviderIdParams,
  listDeliveryProvidersQuerySchema,
  availableProvidersQuerySchema,
} from './delivery-provider.dto.js';

export const deliveryProvidersRouter: Router = Router();
deliveryProvidersRouter.use(authenticate(), tenantScope());

deliveryProvidersRouter.get(
  '/',
  validate({ query: listDeliveryProvidersQuerySchema }),
  asyncHandler(deliveryProviderController.list),
);

deliveryProvidersRouter.get(
  '/available',
  validate({ query: availableProvidersQuerySchema }),
  asyncHandler(deliveryProviderController.getAvailableProviders),
);

deliveryProvidersRouter.get(
  '/:id',
  validate({ params: deliveryProviderIdParams }),
  asyncHandler(deliveryProviderController.getById),
);

deliveryProvidersRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createDeliveryProviderSchema }),
  asyncHandler(deliveryProviderController.create),
);

deliveryProvidersRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryProviderIdParams, body: updateDeliveryProviderSchema }),
  asyncHandler(deliveryProviderController.update),
);

deliveryProvidersRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deliveryProviderIdParams }),
  asyncHandler(deliveryProviderController.remove),
);
