import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { webhooksController } from './webhooks.controller.js';
import { createSubscriptionSchema, updateSubscriptionSchema, idParams } from './webhooks.dto.js';

/**
 * Outbound webhook subscription routes.
 * Inbound provider webhooks live in apps/webhook-handler (separate scaling
 * + signature-verification profile); this module is merchant-facing only.
 */
export const webhooksRouter: Router = Router();
webhooksRouter.use(authenticate(), tenantScope());

webhooksRouter.get('/', asyncHandler(webhooksController.list));

webhooksRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createSubscriptionSchema }),
  asyncHandler(webhooksController.create),
);

webhooksRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams, body: updateSubscriptionSchema }),
  asyncHandler(webhooksController.update),
);

webhooksRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams }),
  asyncHandler(webhooksController.remove),
);

webhooksRouter.post(
  '/:id/test',
  requirePermission('store:write'),
  validate({ params: idParams }),
  asyncHandler(webhooksController.testFire),
);
