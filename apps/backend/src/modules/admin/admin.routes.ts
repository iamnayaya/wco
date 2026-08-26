import { Router } from 'express';

import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { adminController } from './admin.controller.js';
import { listMerchantsQuerySchema } from './admin.dto.js';
import { adminApiKeyGuard } from './admin.guard.js';

/** Platform ops routes - x-admin-key guarded, aggregate reads only. */
export const adminRouter: Router = Router();

adminRouter.use(adminApiKeyGuard);

adminRouter.get('/stats', asyncHandler(adminController.platformStats));

adminRouter.get(
  '/merchants',
  validate({ query: listMerchantsQuerySchema }),
  asyncHandler(adminController.listMerchants),
);
