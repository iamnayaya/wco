import { ValidationError } from '@wco/shared';
import type { Request, Response } from 'express';

import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { customersService } from '../../services/customers.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import type { ListCustomersV2Query } from './customers.dto.js';
import {
  customerNoteService,
} from './services/crm.service.js';
import {
  customerDirectoryService,
} from './services/directory.service.js';
import { customerImportExportService } from './services/import-export.service.js';

/**
 * Customers controller - the WhatsApp CRM directory.
 *
 * Read endpoints require `store:read`; mutations `store:write` (enforced at
 * the router). Export/import and deletes are audit-logged: customer data is
 * PII and "who exported what" is a compliance requirement.
 */

function setCsvHeaders(res: Response, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

export const customersController = {
  /** Offset list with metadata (page/pageSize/totalItems/totalPages). */
  async listV2(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListCustomersV2Query;
    const storeId = getStoreId(req);
    const { items, total } = await customerDirectoryService.listCustomers(storeId, query);
    sendSuccess(res, items, {
      pagination: paginationMeta(query.page, query.pageSize, total),
    });
  },

  async search(req: Request, res: Response): Promise<void> {
    await customersController.listV2(req, res);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await customersService.get(getStoreId(req), req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const customer = await customerDirectoryService.createCustomer(getStoreId(req), req.body);
    sendSuccess(res, customer, undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await customersService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await customerDirectoryService.deleteCustomer(getStoreId(req), req.params.id);
    void auditService.record({
      action: 'customer.delete',
      resource: 'Customer',
      resourceId: req.params.id,
      storeId: getStoreId(req),
    }).catch(() => undefined);
    sendSuccess(res, { deleted: true });
  },

  async addTags(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await customersService.addTags(getStoreId(req), req.params.id, req.body.tags));
  },

  // --- relationship feeds ---------------------------------------------------

  async orders(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Number(req.query.limit ?? 25) || 25, 100);
    sendSuccess(res, await customerDirectoryService.getCustomerOrders(getStoreId(req), req.params.id, limit));
  },

  async messages(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    sendSuccess(res, await customerDirectoryService.getCustomerMessages(getStoreId(req), req.params.id, limit));
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await customerDirectoryService.getCustomerStats(getStoreId(req), req.params.id));
  },

  // --- notes ----------------------------------------------------------------

  async listNotes(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20) || 20), 100);
    const { items, total } = await customerNoteService.listNotes(getStoreId(req), req.params.id, { page, pageSize });
    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async createNote(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    const note = await customerNoteService.createNote(
      getStoreId(req),
      req.params.id,
      auth.mode === 'user' ? auth.userId : null,
      req.body,
    );
    sendSuccess(res, note, undefined, 201);
  },

  async updateNote(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await customerNoteService.updateNote(getStoreId(req), req.params.id, req.params.noteId, req.body),
    );
  },

  async deleteNote(req: Request, res: Response): Promise<void> {
    await customerNoteService.deleteNote(getStoreId(req), req.params.id, req.params.noteId);
    sendSuccess(res, { deleted: true });
  },

  // --- bulk -----------------------------------------------------------------

  async exportCsv(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListCustomersV2Query;
    const csv = await customerImportExportService.exportCsv(getStoreId(req), query);
    setCsvHeaders(res, `customers-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  },

  async importCsv(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) throw new ValidationError('File is required', { field: 'file' });
    const result = await customerImportExportService.importCsv(getStoreId(req), {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });
    void auditService.record({
      action: 'customer.import',
      resource: 'Customer',
      storeId: getStoreId(req),
      after: { created: result.created, skippedDuplicates: result.skippedDuplicates },
    }).catch(() => undefined);
    sendSuccess(res, result, undefined, 201);
  },

} as const;
