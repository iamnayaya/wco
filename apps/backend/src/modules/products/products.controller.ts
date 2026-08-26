import type { Request, Response } from 'express';

import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { cacheService } from '../../services/cache.service.js';
import { productsService } from '../../services/products.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import type { ListProductsQueryDto, ListProductsV2Query } from './products.dto.js';
import {
  productDiscountService,
  productEnrichmentService,
  productImageService,
  productInventoryService,
  productImportExportService,
  productTagCatalogService,
  productVariantService,
  whatsAppCatalogSyncService,
} from './services/barrel.js';

/**
 * Catalog controller.
 *
 * Mutations invalidate the store's catalog cache (`catalog:{storeId}:*`) so
 * the WhatsApp storefront and AI price lookups never serve stale prices -
 * invalidation lives here (write path) rather than inside services because
 * caching is a transport-layer concern.
 */
export const productsController = {
  async list(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    // req.query was already parsed+coerced by validate() upstream; the cast
    // recovers the DTO type that the middleware guarantees at runtime.
    const query = req.query as unknown as ListProductsQueryDto;
    const result = await cacheService.wrap(`catalog:${auth.storeId}:${JSON.stringify(query)}`, 60, () =>
      productsService.list(getStoreId(req), query),
    );
    sendSuccess(res, result.items, { pagination: { nextCursor: result.nextCursor } });
  },

  async create(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const product = await productsService.create(storeId, req.body);
    void auditService.record({ action: 'product.create', resource: 'Product', resourceId: product.id });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, product, undefined, 201);
  },

  async listCategories(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await productsService.listCategories(getStoreId(req)));
  },

  async createCategory(req: Request, res: Response): Promise<void> {
    const category = await productsService.createCategory(getStoreId(req), req.body.name, req.body.sortOrder);
    sendSuccess(res, category, undefined, 201);
  },

  async deleteCategory(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    await productsService.deleteCategory(storeId, req.params.id);
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, { deleted: true });
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await productsService.get(getStoreId(req), req.params.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const product = await productsService.update(storeId, req.params.id, req.body);
    void auditService.record({
      action: 'product.update',
      resource: 'Product',
      resourceId: product.id,
      after: { name: product.name, price: Number(product.price) },
    });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, product);
  },

  /** Archive is soft-delete: order history must keep resolving product names. */
  async archive(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    await productsService.archive(storeId, req.params.id);
    void auditService.record({ action: 'product.archive', resource: 'Product', resourceId: req.params.id });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, { archived: true });
  },

  async adjustStock(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const product = await productsService.adjustStock(storeId, req.params.id, req.body.delta);
    void auditService.record({
      action: 'product.stock-adjust',
      resource: 'Product',
      resourceId: product.id,
      after: { delta: req.body.delta, reason: req.body.reason },
    });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, product);
  },

  // ---------------------------------------------------------------------------
  // v2
  // ---------------------------------------------------------------------------

  async listV2(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListProductsV2Query;
    const { items, total } = await productsService.listV2(getStoreId(req), query);
    sendSuccess(res, items, { pagination: paginationMeta(query.page, query.pageSize, total) });
  },

  async search(req: Request, res: Response): Promise<void> {
    await productsController.listV2(req, res);
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await productsService.stats(getStoreId(req)));
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await productImportExportService.exportCsv(
      getStoreId(req),
      req.query as unknown as Partial<ListProductsV2Query>,
    );
    const stamp = new Date().toISOString().slice(0, 10);
    res.status(200).setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${stamp}.csv"`);
    res.send(csv);
  },

  async importCsv(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const auth = getAuth(req);
    const file = req.file;
    if (!file) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } });
      return;
    }
    const report = await productImportExportService.importCsv(storeId, auth.mode === 'user' ? auth.userId : null, file);
    void auditService.record({
      action: 'product.import',
      resource: 'Product',
      resourceId: storeId,
      after: { ...report },
    });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, report, undefined, 201);
  },

  async syncWhatsApp(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const summary = await whatsAppCatalogSyncService.syncStore(storeId);
    void auditService.record({
      action: 'product.wa-sync',
      resource: 'Store',
      resourceId: storeId,
      after: { ...summary },
    });
    sendSuccess(res, summary);
  },

  async replaceTags(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const tags = await productTagCatalogService.assignToProduct(storeId, req.params.id, req.body.tags);
    void auditService.record({ action: 'product.replace-tags', resource: 'Product', resourceId: req.params.id });
    sendSuccess(res, { tags: tags.map((t) => ({ id: t.id, name: t.name })) });
  },

  async aiDescribe(req: Request, res: Response): Promise<void> {
    const result = await productEnrichmentService.describe(getStoreId(req), req.params.id, req.body);
    sendSuccess(res, result);
  },

  async aiPrice(req: Request, res: Response): Promise<void> {
    const suggestion = await productEnrichmentService.suggestPrice(getStoreId(req), req.params.id);
    void auditService.record({
      action: 'product.ai-price',
      resource: 'Product',
      resourceId: req.params.id,
      after: { suggestedPrice: suggestion.suggestedPrice },
    });
    sendSuccess(res, suggestion, undefined, 201);
  },

  async aiCategorize(req: Request, res: Response): Promise<void> {
    const result = await productEnrichmentService.autoCategorize(getStoreId(req), req.params.id);
    sendSuccess(res, result);
  },
} as const;

/**
 * Sub-resource controllers - variants, images, discounts, inventory.
 * Every handler re-asserts store ownership through its service layer, so a
 * guessed foreign id answers 404 instead of leaking existence.
 */
export const variantsController = {
  create: (req: Request, res: Response): Promise<void> =>
    replyCreated(res, productVariantService.create(getStoreId(req), req.params.id, req.body)),
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, productVariantService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, productVariantService.getOwned(getStoreId(req), req.params.id, req.params.variantId)),
  update: (req: Request, res: Response): Promise<void> =>
    reply(res, productVariantService.update(getStoreId(req), req.params.id, req.params.variantId, req.body)),
  remove: (req: Request, res: Response): Promise<void> =>
    replyDeleted(res, productVariantService.delete(getStoreId(req), req.params.id, req.params.variantId)),
} as const;

export const imagesController = {
  create: (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      reply422(res, 'No image uploaded');
      return Promise.resolve();
    }
    return replyCreated(
      res,
      productImageService.create(getStoreId(req), req.params.id, file, req.body?.altText),
    );
  },
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, productImageService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, productImageService.getOwned(getStoreId(req), req.params.id, req.params.imageId)),
  update: (req: Request, res: Response): Promise<void> =>
    reply(res, productImageService.update(getStoreId(req), req.params.id, req.params.imageId, req.body)),
  remove: (req: Request, res: Response): Promise<void> =>
    replyDeleted(res, productImageService.delete(getStoreId(req), req.params.id, req.params.imageId)),
  setPrimary: (req: Request, res: Response): Promise<void> =>
    reply(res, productImageService.setPrimary(getStoreId(req), req.params.id, req.params.imageId)),
} as const;

export const discountsController = {
  create: (req: Request, res: Response): Promise<void> =>
    replyCreated(res, productDiscountService.create(getStoreId(req), req.params.id, req.body)),
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, productDiscountService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, productDiscountService.getOwned(getStoreId(req), req.params.id, req.params.discountId)),
  update: (req: Request, res: Response): Promise<void> =>
    reply(res, productDiscountService.update(getStoreId(req), req.params.id, req.params.discountId, req.body)),
  remove: (req: Request, res: Response): Promise<void> =>
    replyDeleted(res, productDiscountService.delete(getStoreId(req), req.params.id, req.params.discountId)),
  apply: (req: Request, res: Response): Promise<void> =>
    reply(res, productDiscountService.apply(getStoreId(req), req.params.id, req.body.code)),
} as const;

export const inventoryController = {
  getStock: (req: Request, res: Response): Promise<void> =>
    reply(res, productInventoryService.get(getStoreId(req), req.params.id)),
  history: (req: Request, res: Response): Promise<void> =>
    reply(res, productInventoryService.history(getStoreId(req), req.params.id)),
  adjust: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return reply(res, productInventoryService.adjust(getStoreId(req), req.params.id, req.body, auth.mode === 'user' ? auth.userId : null));
  },
  listAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as { page: number; pageSize: number; q?: string; lowStockOnly: boolean };
    const { items, total } = await productInventoryService.listInventory(getStoreId(req), query);
    sendSuccess(res, items, { pagination: paginationMeta(query.page, query.pageSize, total) });
  },
  lowStock: (req: Request, res: Response): Promise<void> =>
    reply(res, productInventoryService.lowStock(getStoreId(req))),
} as const;

// ---------------------------------------------------------------------------
// Small response helpers (keep the controller table terse)
// ---------------------------------------------------------------------------

function reply(res: Response, data: Promise<unknown>): Promise<void> {
  return data.then((payload) => {
    sendSuccess(res, payload);
  });
}

function replyCreated(res: Response, data: Promise<unknown>): Promise<void> {
  return data.then((payload) => {
    sendSuccess(res, payload, undefined, 201);
  });
}

async function replyDeleted(res: Response, p: Promise<void>): Promise<void> {
  await p;
  sendSuccess(res, { deleted: true });
}

function reply422(res: Response, message: string): void {
  res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
}
