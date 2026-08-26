import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { subscriptionsController } from './subscriptions.controller.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  renewSubscriptionSchema,
  changePlanSchema,
} from './subscriptions.dto.js';

/**
 * Subscription routes — merchant billing lifecycle.
 *
 * All routes require authentication + tenant scoping. Subscription
 * management is restricted to OWNER/ADMIN roles via billing:manage.
 */
export const subscriptionsRouter: Router = Router();
subscriptionsRouter.use(authenticate(), tenantScope());

// --- get current subscription ------------------------------------------------

subscriptionsRouter.get(
  '/me',
  asyncHandler(subscriptionsController.getMySubscription),
);

// --- create subscription -----------------------------------------------------

subscriptionsRouter.post(
  '/',
  requirePermission('billing:manage'),
  validate({ body: createSubscriptionSchema }),
  asyncHandler(subscriptionsController.create),
);

// --- update subscription -----------------------------------------------------

subscriptionsRouter.patch(
  '/',
  requirePermission('billing:manage'),
  validate({ body: updateSubscriptionSchema }),
  asyncHandler(subscriptionsController.update),
);

// --- cancel subscription -----------------------------------------------------

subscriptionsRouter.post(
  '/cancel',
  requirePermission('billing:manage'),
  validate({ body: cancelSubscriptionSchema }),
  asyncHandler(subscriptionsController.cancel),
);

// --- renew subscription ------------------------------------------------------

subscriptionsRouter.post(
  '/renew',
  requirePermission('billing:manage'),
  validate({ body: renewSubscriptionSchema }),
  asyncHandler(subscriptionsController.renew),
);

// --- upgrade subscription ----------------------------------------------------

subscriptionsRouter.post(
  '/upgrade',
  requirePermission('billing:manage'),
  validate({ body: changePlanSchema }),
  asyncHandler(subscriptionsController.upgrade),
);

// --- downgrade subscription --------------------------------------------------

subscriptionsRouter.post(
  '/downgrade',
  requirePermission('billing:manage'),
  validate({ body: changePlanSchema }),
  asyncHandler(subscriptionsController.downgrade),
);
