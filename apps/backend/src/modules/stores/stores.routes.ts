import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { storesController } from './stores.controller.js';
import { storeBodySchema, idParams } from './stores.dto.js';

/** Store management - the merchant's commerce locations. */
export const storesRouter: Router = Router();
storesRouter.use(authenticate());

storesRouter.get('/', asyncHandler(storesController.list));

storesRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: storeBodySchema }),
  asyncHandler(storesController.create),
);

storesRouter.get(
  '/:id',
  requirePermission('store:read'),
  validate({ params: idParams }),
  asyncHandler(storesController.get),
);

storesRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams, body: storeBodySchema.partial() }),
  asyncHandler(storesController.update),
);
