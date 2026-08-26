import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { subscriptionPlansController } from './subscription-plans.controller.js';
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  subscriptionPlanIdParams,
  listSubscriptionPlansQuerySchema,
} from './subscription-plans.dto.js';

/**
 * Subscription plan routes — platform plan catalog management.
 *
 * Read access for all authenticated users. Write access restricted to
 * SUPER_ADMIN (platform ops only).
 */
export const subscriptionPlansRouter: Router = Router();
subscriptionPlansRouter.use(authenticate(), tenantScope());

// --- list -------------------------------------------------------------------

subscriptionPlansRouter.get(
  '/',
  validate({ query: listSubscriptionPlansQuerySchema }),
  asyncHandler(subscriptionPlansController.list),
);

// --- get by slug (literal before /:id) --------------------------------------

subscriptionPlansRouter.get(
  '/slug/:slug',
  asyncHandler(subscriptionPlansController.getBySlug),
);

// --- create (admin only) ----------------------------------------------------

subscriptionPlansRouter.post(
  '/',
  requireRole('SUPER_ADMIN'),
  validate({ body: createSubscriptionPlanSchema }),
  asyncHandler(subscriptionPlansController.create),
);

// --- get by ID ---------------------------------------------------------------

subscriptionPlansRouter.get(
  '/:id',
  validate({ params: subscriptionPlanIdParams }),
  asyncHandler(subscriptionPlansController.getById),
);

// --- update (admin only) ----------------------------------------------------

subscriptionPlansRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN'),
  validate({ params: subscriptionPlanIdParams, body: updateSubscriptionPlanSchema }),
  asyncHandler(subscriptionPlansController.update),
);

// --- delete (admin only) ----------------------------------------------------

subscriptionPlansRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN'),
  validate({ params: subscriptionPlanIdParams }),
  asyncHandler(subscriptionPlansController.remove),
);
