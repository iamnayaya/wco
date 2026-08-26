import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { paymentMethodsController } from './payment-methods.controller.js';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  paymentMethodIdParams,
  listPaymentMethodsQuerySchema,
} from './payment-methods.dto.js';

/**
 * Payment method routes — merchant payout destination management.
 *
 * All routes require authentication + tenant scoping. Write operations
 * require billing:manage permission (OWNER only).
 */
export const paymentMethodsRouter: Router = Router();
paymentMethodsRouter.use(authenticate(), tenantScope());

// --- list -------------------------------------------------------------------

paymentMethodsRouter.get(
  '/',
  validate({ query: listPaymentMethodsQuerySchema }),
  asyncHandler(paymentMethodsController.list),
);

// --- create -----------------------------------------------------------------

paymentMethodsRouter.post(
  '/',
  requirePermission('billing:manage'),
  validate({ body: createPaymentMethodSchema }),
  asyncHandler(paymentMethodsController.create),
);

// --- get by ID ---------------------------------------------------------------

paymentMethodsRouter.get(
  '/:id',
  validate({ params: paymentMethodIdParams }),
  asyncHandler(paymentMethodsController.getById),
);

// --- update -----------------------------------------------------------------

paymentMethodsRouter.patch(
  '/:id',
  requirePermission('billing:manage'),
  validate({ params: paymentMethodIdParams, body: updatePaymentMethodSchema }),
  asyncHandler(paymentMethodsController.update),
);

// --- delete -----------------------------------------------------------------

paymentMethodsRouter.delete(
  '/:id',
  requirePermission('billing:manage'),
  validate({ params: paymentMethodIdParams }),
  asyncHandler(paymentMethodsController.remove),
);

// --- set default -------------------------------------------------------------

paymentMethodsRouter.post(
  '/:id/set-default',
  requirePermission('billing:manage'),
  validate({ params: paymentMethodIdParams }),
  asyncHandler(paymentMethodsController.setDefault),
);
