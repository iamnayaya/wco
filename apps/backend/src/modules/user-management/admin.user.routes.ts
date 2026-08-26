import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { requirePlatformAdmin } from '../../middleware/platform-admin.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { adminUsersController } from './admin-users.controller.js';
import {
  adminCreateUserSchema,
  adminListQuerySchema,
  adminUpdateUserSchema,
  idParams,
  suspendSchema,
} from './user-management.dto.js';

/**
 * Platform user-management routes (/admin/users).
 *
 * Middleware chain: authenticate (JWT) -> requirePlatformAdmin (staff roster
 * check) -> per-route validation. SUPER_ADMIN bypasses the roster lookup;
 * merchant-team ADMINs without an adminProfile row are rejected here.
 */
export const adminUsersRouter: Router = Router();

adminUsersRouter.use(authenticate(), requirePlatformAdmin());

adminUsersRouter.get(
  '/',
  validate({ query: adminListQuerySchema }),
  asyncHandler(adminUsersController.list),
);

adminUsersRouter.post(
  '/',
  validate({ body: adminCreateUserSchema }),
  asyncHandler(adminUsersController.create),
);

adminUsersRouter.get('/:id', validate({ params: idParams }), asyncHandler(adminUsersController.getById));

adminUsersRouter.put(
  '/:id',
  validate({ params: idParams, body: adminUpdateUserSchema }),
  asyncHandler(adminUsersController.update),
);

adminUsersRouter.delete(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(adminUsersController.remove),
);

adminUsersRouter.post(
  '/:id/suspend',
  validate({ params: idParams, body: suspendSchema }),
  asyncHandler(adminUsersController.suspend),
);

adminUsersRouter.post(
  '/:id/unsuspend',
  validate({ params: idParams }),
  asyncHandler(adminUsersController.unsuspend),
);

adminUsersRouter.get(
  '/:id/stats',
  validate({ params: idParams }),
  asyncHandler(adminUsersController.stats),
);
