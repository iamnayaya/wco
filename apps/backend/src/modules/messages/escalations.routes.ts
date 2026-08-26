import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { escalationsController } from './escalations.controller.js';
import {
  escalationCreateSchema,
  escalationParams,
  escalationResolveSchema,
  escalationUpdateSchema,
  idParams,
  listEscalationsQuerySchema,
} from './messages.dto.js';

/** /api/v1/message-escalations - human takeover queue. */
export const messageEscalationsRouter: Router = Router();
messageEscalationsRouter.use(authenticate(), tenantScope());

messageEscalationsRouter.get(
  '/',
  validate({ query: listEscalationsQuerySchema }),
  asyncHandler(escalationsController.list),
);

messageEscalationsRouter.post(
  '/',
  requirePermission('conversation:handle'),
  validate({ body: escalationCreateSchema }),
  asyncHandler(escalationsController.create),
);

messageEscalationsRouter.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(escalationsController.get),
);

messageEscalationsRouter.put(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: escalationParams, body: escalationUpdateSchema }),
  asyncHandler(escalationsController.update),
);

messageEscalationsRouter.delete(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: idParams }),
  asyncHandler(escalationsController.remove),
);

messageEscalationsRouter.post(
  '/:id/resolve',
  requirePermission('conversation:handle'),
  validate({ params: escalationParams, body: escalationResolveSchema }),
  asyncHandler(escalationsController.resolve),
);
