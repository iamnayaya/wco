import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveryClaimController } from './delivery-claim.controller.js';
import {
  deliveryClaimIdParams,
  createDeliveryClaimSchema,
  updateDeliveryClaimSchema,
  processClaimSchema,
  listClaimsQuerySchema,
} from './delivery-claim.dto.js';

export const deliveryClaimsRouter: Router = Router({ mergeParams: true });
deliveryClaimsRouter.use(authenticate(), tenantScope());

deliveryClaimsRouter.get(
  '/',
  validate({ query: listClaimsQuerySchema }),
  asyncHandler(deliveryClaimController.listByDelivery),
);

deliveryClaimsRouter.get(
  '/:claimId',
  validate({ params: deliveryClaimIdParams }),
  asyncHandler(deliveryClaimController.getById),
);

deliveryClaimsRouter.post(
  '/',
  requirePermission('order:write'),
  validate({ body: createDeliveryClaimSchema }),
  asyncHandler(deliveryClaimController.create),
);

deliveryClaimsRouter.patch(
  '/:claimId',
  requirePermission('order:write'),
  validate({ params: deliveryClaimIdParams, body: updateDeliveryClaimSchema }),
  asyncHandler(deliveryClaimController.update),
);

deliveryClaimsRouter.delete(
  '/:claimId',
  requirePermission('order:write'),
  validate({ params: deliveryClaimIdParams }),
  asyncHandler(deliveryClaimController.remove),
);

deliveryClaimsRouter.post(
  '/:claimId/process',
  requirePermission('store:write'),
  validate({ params: deliveryClaimIdParams, body: processClaimSchema }),
  asyncHandler(deliveryClaimController.process),
);
