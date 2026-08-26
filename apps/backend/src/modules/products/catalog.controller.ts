import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { sendSuccess } from '../../utils/api-response.js';

import { categoryV2Service, productTagCatalogService } from './services/barrel.js';

/** Taxonomy controllers - categories (v2) and the product tag catalog. */
export const productCategoriesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await categoryV2Service.list(getStoreId(req)));
  },

  create: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await categoryV2Service.create(getStoreId(req), req.body), undefined, 201);
  },

  get: async (req: Request, res: Response): Promise<void> => {
    const category = await categoryV2Service.getOwned(getStoreId(req), req.params.id);
    sendSuccess(res, category);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const category = await categoryV2Service.update(getStoreId(req), req.params.id, req.body);
    void auditService.record({ action: 'product-category.update', resource: 'Category', resourceId: category.id });
    sendSuccess(res, category);
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    const storeId = getStoreId(req);
    await categoryV2Service.delete(storeId, req.params.id);
    void auditService.record({ action: 'product-category.delete', resource: 'Category', resourceId: req.params.id });
    sendSuccess(res, { deleted: true });
  },
} as const;

export const productTagsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await productTagCatalogService.list(getStoreId(req)));
  },

  create: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await productTagCatalogService.create(getStoreId(req), req.body), undefined, 201);
  },

  get: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await productTagCatalogService.getOwned(getStoreId(req), req.params.id));
  },

  update: async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await productTagCatalogService.update(getStoreId(req), req.params.id, req.body));
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    await productTagCatalogService.delete(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },
} as const;
