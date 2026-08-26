import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { productTagsController } from './catalog.controller.js';
import { idParams, productTagBodySchema, productTagUpdateSchema } from './products.dto.js';

/** Product tag catalog - mounted at /product-tags. */
export const productTagsRouter: Router = Router();
productTagsRouter.use(authenticate(), tenantScope());

productTagsRouter.get('/', asyncHandler(productTagsController.list));

productTagsRouter.post(
  '/',
  requirePermission('product:write'),
  validate({ body: productTagBodySchema }),
  asyncHandler(productTagsController.create),
);

productTagsRouter.get('/:id', validate({ params: idParams }), asyncHandler(productTagsController.get));

productTagsRouter.put(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams, body: productTagUpdateSchema }),
  asyncHandler(productTagsController.update),
);

productTagsRouter.delete(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productTagsController.remove),
);
