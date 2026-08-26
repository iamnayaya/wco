import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { inventoryController } from './products.controller.js';
import { inventoryListQuerySchema } from './products.dto.js';

/**
 * Store-wide inventory view - mounted at /inventory.
 * Read-only: mutations live under /products/:id/inventory where the
 * product (and optional variant) is identified.
 */
export const inventoryRouter: Router = Router();
inventoryRouter.use(authenticate(), tenantScope());

inventoryRouter.get(
  '/',
  validate({ query: inventoryListQuerySchema }),
  asyncHandler(inventoryController.listAll),
);

inventoryRouter.get('/low-stock', asyncHandler(inventoryController.lowStock));
