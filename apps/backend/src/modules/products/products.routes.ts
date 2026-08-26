import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { multerErrorHandler, uploadSingle, uploadSingleCsv } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  discountsController,
  imagesController,
  inventoryController,
  productsController,
  variantsController,
} from './products.controller.js';
import {
  adjustInventorySchema,
  adjustStockSchema,
  aiDescribeSchema,
  applyDiscountSchema,
  categoryBodySchema,
  discountBodySchema,
  discountParams,
  discountUpdateSchema,
  idParams,
  imageParams,
  imageUpdateSchema,
  listProductsV2QuerySchema,
  productBodySchema,
  replaceTagsSchema,
  searchProductsQuerySchema,
  variantBodySchema,
  variantParams,
  variantUpdateSchema,
} from './products.dto.js';

/**
 * Catalog routes.
 *
 * Mount order matters: literal segments (/search, /export, /import, /stats,
 * /sync-whatsapp, /categories) are registered BEFORE the /:id wildcard.
 * Reads are open to any authenticated team member; mutations require
 * `product:write` (RBAC) and store isolation comes from tenantScope().
 */
export const productsRouter: Router = Router();
productsRouter.use(authenticate(), tenantScope());

// --- collection-level ---------------------------------------------------------

productsRouter.get('/', validate({ query: listProductsV2QuerySchema }), asyncHandler(productsController.listV2));

productsRouter.post(
  '/',
  requirePermission('product:write'),
  validate({ body: productBodySchema }),
  asyncHandler(productsController.create),
);

productsRouter.get(
  '/search',
  validate({ query: searchProductsQuerySchema }),
  asyncHandler(productsController.search),
);

productsRouter.get('/export', asyncHandler(productsController.exportCsv));

productsRouter.post(
  '/import',
  requirePermission('product:write'),
  uploadSingleCsv('file'),
  multerErrorHandler,
  asyncHandler(productsController.importCsv),
);

productsRouter.get('/stats', asyncHandler(productsController.stats));

productsRouter.post(
  '/sync-whatsapp',
  requirePermission('product:write'),
  asyncHandler(productsController.syncWhatsApp),
);

// --- taxonomy (legacy inline categories kept for compatibility) ----------------

productsRouter.get('/categories', asyncHandler(productsController.listCategories));

productsRouter.post(
  '/categories',
  requirePermission('product:write'),
  validate({ body: categoryBodySchema }),
  asyncHandler(productsController.createCategory),
);

productsRouter.delete(
  '/categories/:id',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productsController.deleteCategory),
);

// --- item-level ----------------------------------------------------------------

productsRouter.get('/:id', validate({ params: idParams }), asyncHandler(productsController.get));

productsRouter.patch(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams, body: productBodySchema.partial() }),
  asyncHandler(productsController.update),
);

productsRouter.delete(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productsController.archive),
);

productsRouter.put(
  '/:id/tags',
  requirePermission('product:write'),
  validate({ params: idParams, body: replaceTagsSchema }),
  asyncHandler(productsController.replaceTags),
);

// --- AI enrichment --------------------------------------------------------------

productsRouter.post(
  '/:id/ai/describe',
  requirePermission('product:write'),
  validate({ params: idParams, body: aiDescribeSchema }),
  asyncHandler(productsController.aiDescribe),
);

productsRouter.post(
  '/:id/ai/price',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productsController.aiPrice),
);

productsRouter.post(
  '/:id/ai/categorize',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productsController.aiCategorize),
);

// --- variants --------------------------------------------------------------------

productsRouter.get('/:id/variants', validate({ params: idParams }), asyncHandler(variantsController.list));

productsRouter.post(
  '/:id/variants',
  requirePermission('product:write'),
  validate({ params: idParams, body: variantBodySchema }),
  asyncHandler(variantsController.create),
);

productsRouter.get('/:id/variants/:variantId', validate({ params: variantParams }), asyncHandler(variantsController.get));

productsRouter.put(
  '/:id/variants/:variantId',
  requirePermission('product:write'),
  validate({ params: variantParams, body: variantUpdateSchema }),
  asyncHandler(variantsController.update),
);

productsRouter.delete(
  '/:id/variants/:variantId',
  requirePermission('product:write'),
  validate({ params: variantParams }),
  asyncHandler(variantsController.remove),
);

// --- images ------------------------------------------------------------------------

productsRouter.get('/:id/images', validate({ params: idParams }), asyncHandler(imagesController.list));

productsRouter.post(
  '/:id/images',
  requirePermission('product:write'),
  uploadSingle('image'),
  multerErrorHandler,
  asyncHandler(imagesController.create),
);

productsRouter.get('/:id/images/:imageId', validate({ params: imageParams }), asyncHandler(imagesController.get));

productsRouter.put(
  '/:id/images/:imageId',
  requirePermission('product:write'),
  validate({ params: imageParams, body: imageUpdateSchema }),
  asyncHandler(imagesController.update),
);

productsRouter.delete(
  '/:id/images/:imageId',
  requirePermission('product:write'),
  validate({ params: imageParams }),
  asyncHandler(imagesController.remove),
);

productsRouter.post(
  '/:id/images/:imageId/primary',
  requirePermission('product:write'),
  validate({ params: imageParams }),
  asyncHandler(imagesController.setPrimary),
);

// --- discounts -----------------------------------------------------------------------

productsRouter.get('/:id/discounts', validate({ params: idParams }), asyncHandler(discountsController.list));

productsRouter.post(
  '/:id/discounts',
  requirePermission('product:write'),
  validate({ params: idParams, body: discountBodySchema }),
  asyncHandler(discountsController.create),
);

productsRouter.get(
  '/:id/discounts/:discountId',
  validate({ params: discountParams }),
  asyncHandler(discountsController.get),
);

productsRouter.put(
  '/:id/discounts/:discountId',
  requirePermission('product:write'),
  validate({ params: discountParams, body: discountUpdateSchema }),
  asyncHandler(discountsController.update),
);

productsRouter.delete(
  '/:id/discounts/:discountId',
  requirePermission('product:write'),
  validate({ params: discountParams }),
  asyncHandler(discountsController.remove),
);

productsRouter.post(
  '/:id/discounts/apply',
  validate({ params: idParams, body: applyDiscountSchema }),
  asyncHandler(discountsController.apply),
);

// --- stock -----------------------------------------------------------------------------

productsRouter.post(
  '/:id/stock',
  requirePermission('product:write'),
  validate({ params: idParams, body: adjustStockSchema }),
  asyncHandler(productsController.adjustStock),
);

productsRouter.get('/:id/inventory', validate({ params: idParams }), asyncHandler(inventoryController.getStock));

productsRouter.get('/:id/inventory/history', validate({ params: idParams }), asyncHandler(inventoryController.history));

productsRouter.put(
  '/:id/inventory',
  requirePermission('product:write'),
  validate({ params: idParams, body: adjustInventorySchema }),
  asyncHandler(inventoryController.adjust),
);
