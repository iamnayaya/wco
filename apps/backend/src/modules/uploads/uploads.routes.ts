import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { multerErrorHandler, uploadSingle } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { uploadsController } from './uploads.controller.js';
import { objectKeySchema, uploadBodySchema } from './uploads.dto.js';

/**
 * Upload routes - multipart in, S3 out. Nothing touches local disk.
 * `multerErrorHandler` must follow the multer middleware so size/MIME
 * violations become 422s instead of HTML error pages.
 */
export const uploadsRouter: Router = Router();
uploadsRouter.use(authenticate(), tenantScope());

uploadsRouter.post(
  '/',
  requirePermission('product:write'),
  uploadSingle('file'),
  multerErrorHandler,
  // Runs AFTER multer so text form-fields are already merged into req.body.
  validate({ body: uploadBodySchema }),
  asyncHandler(uploadsController.upload),
);

uploadsRouter.get(
  '/presign',
  validate({ query: objectKeySchema }),
  asyncHandler(uploadsController.presign),
);

uploadsRouter.delete(
  '/',
  requirePermission('product:write'),
  validate({ body: objectKeySchema }),
  asyncHandler(uploadsController.remove),
);
