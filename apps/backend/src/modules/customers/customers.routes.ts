import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { uploadSingleCsv, multerErrorHandler } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { customersController } from './customers.controller.js';
import {
  addTagsSchema,
  createCustomerSchema,
  createNoteSchema,
  deleteCustomerParams,
  idParams,
  listCustomersV2QuerySchema,
  noteParams,
  searchCustomersQuerySchema,
  updateCustomerSchema,
  updateNoteSchema,
} from './customers.dto.js';

/**
 * Customer CRM routes.
 *
 * Mount-order matters: literal paths (/search, /export, /import) are
 * registered BEFORE the /:id wildcard so Express never swallows them as an
 * id. Reads need `store:read`; every mutation needs `store:write` - RBAC is
 * declared per-route and tenant isolation comes from tenantScope().
 */
export const customersRouter: Router = Router();
customersRouter.use(authenticate(), tenantScope());

// --- reads -------------------------------------------------------------------

customersRouter.get(
  '/',
  validate({ query: listCustomersV2QuerySchema }),
  asyncHandler(customersController.listV2),
);

customersRouter.get(
  '/search',
  validate({ query: searchCustomersQuerySchema }),
  asyncHandler(customersController.search),
);

customersRouter.get(
  '/export',
  validate({ query: listCustomersV2QuerySchema.partial() }),
  asyncHandler(customersController.exportCsv),
);

customersRouter.post(
  '/import',
  requirePermission('store:write'),
  uploadSingleCsv('file'),
  multerErrorHandler,
  asyncHandler(customersController.importCsv),
);

// --- notes (nested under /:id) -------------------------------------------------

customersRouter.get('/:id/notes', validate({ params: idParams }), asyncHandler(customersController.listNotes));

customersRouter.post(
  '/:id/notes',
  requirePermission('store:write'),
  validate({ params: idParams, body: createNoteSchema }),
  asyncHandler(customersController.createNote),
);

customersRouter.put(
  '/:id/notes/:noteId',
  requirePermission('store:write'),
  validate({ params: noteParams, body: updateNoteSchema }),
  asyncHandler(customersController.updateNote),
);

customersRouter.delete(
  '/:id/notes/:noteId',
  requirePermission('store:write'),
  validate({ params: noteParams }),
  asyncHandler(customersController.deleteNote),
);

// --- relationship feeds --------------------------------------------------------

customersRouter.get('/:id/orders', validate({ params: idParams }), asyncHandler(customersController.orders));

customersRouter.get('/:id/messages', validate({ params: idParams }), asyncHandler(customersController.messages));

customersRouter.get('/:id/stats', validate({ params: idParams }), asyncHandler(customersController.stats));

// --- lifecycle -----------------------------------------------------------------

customersRouter.get('/:id', validate({ params: idParams }), asyncHandler(customersController.get));

customersRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createCustomerSchema }),
  asyncHandler(customersController.create),
);

customersRouter.patch(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams, body: updateCustomerSchema }),
  asyncHandler(customersController.update),
);

customersRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: deleteCustomerParams }),
  asyncHandler(customersController.remove),
);

customersRouter.post(
  '/:id/tags',
  requirePermission('store:write'),
  validate({ params: idParams, body: addTagsSchema }),
  asyncHandler(customersController.addTags),
);
