import { ForbiddenError, ValidationError } from '@wco/shared';
import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { uploadsService } from '../../services/uploads.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/**
 * Uploads controller - media in/out of S3.
 *
 * Tenant isolation: every key-bearing operation asserts the object lives
 * under the authenticated store's prefix. Defense in depth alongside the
 * server-generated key format.
 */

function assertOwnedKey(storeId: string, key: string): void {
  if (!key.startsWith(`${storeId}/`)) {
    throw new ForbiddenError('Object belongs to another store');
  }
}

/** Server-side folder allow-list - folder becomes a key path segment, so
 * free-form input would be a traversal risk. Mirrors uploads.dto enum. */
const FOLDER_PATTERN = /^[a-z0-9-]{1,40}$/;

export const uploadsController = {
  async upload(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) throw new ValidationError('File is required', { field: 'file' });

    const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'products';
    if (!FOLDER_PATTERN.test(folder)) {
      throw new ValidationError('Invalid folder', { folder });
    }

    const result = await uploadsService.upload(getStoreId(req), folder, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    sendSuccess(res, result, undefined, 201);
  },

  /** Short-lived private-read URL (delivery PODs, invoices). */
  async presign(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    assertOwnedKey(storeId, String(req.query.key));
    sendSuccess(res, { url: await uploadsService.presignRead(String(req.query.key)) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    assertOwnedKey(storeId, req.body.key);
    await uploadsService.delete(req.body.key);
    sendSuccess(res, { deleted: true });
  },
} as const;
