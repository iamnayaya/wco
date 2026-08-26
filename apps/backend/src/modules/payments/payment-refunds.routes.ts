import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { paymentRefundsController } from './payment-refunds.controller.js';
import {
  createRefundSchema,
  listRefundsQuerySchema,
  paymentIdParam,
  refundIdParam,
} from './payment-refunds.dto.js';

/**
 * Payment refund routes — scoped under /payments/:id/refunds.
 *
 * All routes require authentication + tenant scoping. Refund creation
 * and processing require billing:manage permission.
 */
export const paymentRefundsRouter: Router = Router({ mergeParams: true });
paymentRefundsRouter.use(authenticate(), tenantScope());

// --- list refunds for a payment ----------------------------------------------

paymentRefundsRouter.get(
  '/',
  validate({ params: paymentIdParam, query: listRefundsQuerySchema }),
  asyncHandler(paymentRefundsController.list),
);

// --- create refund ------------------------------------------------------------

paymentRefundsRouter.post(
  '/',
  requirePermission('billing:manage'),
  validate({ params: paymentIdParam, body: createRefundSchema }),
  asyncHandler(paymentRefundsController.create),
);

// --- get refund by ID ---------------------------------------------------------

paymentRefundsRouter.get(
  '/:refundId',
  validate({ params: refundIdParam }),
  asyncHandler(paymentRefundsController.getById),
);

// --- process refund -----------------------------------------------------------

paymentRefundsRouter.post(
  '/:refundId/process',
  requirePermission('billing:manage'),
  validate({ params: refundIdParam }),
  asyncHandler(paymentRefundsController.process),
);

// --- cancel refund ------------------------------------------------------------

paymentRefundsRouter.post(
  '/:refundId/cancel',
  requirePermission('billing:manage'),
  validate({ params: refundIdParam }),
  asyncHandler(paymentRefundsController.cancel),
);
