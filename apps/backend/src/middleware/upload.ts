import { ValidationError } from '@wco/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';

import { UPLOAD_LIMITS } from '../config/constants.js';

/**
 * Multer upload middleware — memory storage.
 *
 * Files stream into a bounded memory buffer, get validated (size + MIME),
 * then are pushed to S3 by the uploads service. Nothing ever touches the
 * local disk: containers are ephemeral and read-only-friendly. MIME is also
 * re-checked against magic bytes in uploads.service — client headers lie.
 */

const makeUploader = (
  extraMimeTypes: readonly string[] = [],
  maxBytes: number = UPLOAD_LIMITS.MAX_FILE_BYTES,
): multer.Multer =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: UPLOAD_LIMITS.MAX_FILES_PER_REQUEST,
    },
    fileFilter: (_req, file, cb) => {
      const allowed: readonly string[] = [
        ...(UPLOAD_LIMITS.ALLOWED_MIME_TYPES as readonly string[]),
        ...extraMimeTypes,
      ];
      if (!allowed.includes(file.mimetype)) {
        cb(new ValidationError('Unsupported file type', { mimetype: file.mimetype }));
        return;
      }
      cb(null, true);
    },
  });

const upload = makeUploader();

/** Accepts field name(s); single-file variant for product images & POD proofs. */
export const uploadSingle = (fieldName = 'file'): RequestHandler =>
  upload.single(fieldName) as unknown as RequestHandler;

/** CSV uploads (customer imports) - text/csv is not in the media allowlist. */
export const uploadSingleCsv = (fieldName = 'file'): RequestHandler =>
  makeUploader(['text/csv', 'application/vnd.ms-excel', 'text/plain']).single(
    fieldName,
  ) as unknown as RequestHandler;

/** WhatsApp media: voice notes + video ride on the base allowlist, 10 MB. */
export const MESSAGE_MEDIA_MIME_TYPES = ['audio/ogg', 'audio/mpeg', 'video/mp4'] as const;
export const MESSAGE_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const uploadMessageMedia = (fieldName = 'file'): RequestHandler =>
  makeUploader(MESSAGE_MEDIA_MIME_TYPES, MESSAGE_MAX_ATTACHMENT_BYTES).single(
    fieldName,
  ) as unknown as RequestHandler;
export const uploadArray = (fieldName = 'files'): RequestHandler =>
  upload.array(fieldName, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST) as unknown as RequestHandler;

/** Express 4 error middleware - converts Multer's native errors to our 422 envelope. */
export function multerErrorHandler(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    next(new ValidationError(err.message, { code: err.code }));
    return;
  }
  next(err);
}
