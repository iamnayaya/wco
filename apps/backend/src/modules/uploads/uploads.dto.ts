import { z } from 'zod';

/**
 * Upload DTOs.
 *
 * Storage keys are server-generated (`{storeId}/{folder}/{uuid}.{ext}`) -
 * clients only choose the logical folder. Key-bearing endpoints validate the
 * tenant prefix so a store can never read/delete another store's objects.
 */

export const UPLOAD_FOLDERS = ['products', 'chat', 'delivery-proof', 'branding'] as const;

export const uploadBodySchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS).default('products'),
});

/** Server-generated keys: storeId/folder/uuid.ext - no traversal characters. */
const keyPattern = /^[a-z0-9]+\/[a-z0-9-]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

export const objectKeySchema = z.object({
  key: z.string().min(10).max(256).regex(keyPattern, 'Malformed object key'),
});

export type UploadBodyDto = z.infer<typeof uploadBodySchema>;
