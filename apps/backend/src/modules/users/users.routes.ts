import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission, requireMinRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { usersController } from './users.controller.js';
import { createUserSchema, updateRoleSchema, updateStatusSchema, idParams } from './users.dto.js';

/** Team management routes - merchant-scoped via tenantScope. */
export const usersRouter: Router = Router();
usersRouter.use(authenticate(), tenantScope());

usersRouter.get('/', requirePermission('user:manage'), asyncHandler(usersController.list));

usersRouter.post(
  '/',
  requireMinRole('OWNER'),
  validate({ body: createUserSchema }),
  asyncHandler(usersController.create),
);

usersRouter.patch(
  '/:id/role',
  requireMinRole('OWNER'),
  validate({ params: idParams, body: updateRoleSchema }),
  asyncHandler(usersController.updateRole),
);

usersRouter.patch(
  '/:id/status',
  requirePermission('user:manage'),
  validate({ params: idParams, body: updateStatusSchema }),
  asyncHandler(usersController.updateStatus),
);
