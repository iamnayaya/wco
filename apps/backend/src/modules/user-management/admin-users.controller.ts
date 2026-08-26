import type { Request, Response } from 'express';

import { auditService } from '../../services/audit.service.js';
import { authService } from '../../services/auth.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { adminProfileService, sellerProfileService } from './services/profiles.service.js';
import { userService } from './services/user.service.js';
import type { AdminListQuery } from './user-management.dto.js';

/**
 * Platform-admin user management (/admin/users).
 *
 * Every mutation writes an audit row - actor identity is captured from the
 * request tenant context (AsyncLocalStorage) inside auditService.record.
 * The console is the most sensitive surface in the product and "who did
 * this" is a first-class requirement, not an afterthought.
 */

export const adminUsersController = {
  async list(req: Request, res: Response): Promise<void> {
    // validate() already replaced req.query with the parsed value; the cast
    // bridges Express's ParsedQs typing.
    const query = req.query as unknown as AdminListQuery;
    const { items, total } = await userService.listUsers(query);
    const meta = paginationMeta(query.page, query.pageSize, total);
    sendSuccess(res, items, { pagination: meta });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await userService.getUserById(req.params.id));
  },

  /** Creates seller tenants (OWNER) or staff users (ADMIN + merchantId). */
  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const passwordHash = await authService.hashPassword(body.password);

    if (body.role === 'ADMIN') {
      const { user } = await userService.createStaffUser({
        merchantId: body.merchantId,
        fullName: body.fullName,
        email: body.email,
        passwordHash,
        phone: body.phone,
      });
      void adminProfileService.createAdminProfile(user.id, { permissions: [] }).catch(() => undefined);
      sendSuccess(res, user, undefined, 201);
      return;
    }

    const { user } = await userService.createUser({
      companyName: body.companyName,
      fullName: body.fullName,
      email: body.email,
      passwordHash,
      phone: body.phone,
      country: body.country,
    });
    void sellerProfileService
      .createSellerProfile(user.id, { businessName: body.companyName, country: body.country })
      .catch(() => undefined);
    sendSuccess(res, user, undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const before = await userService.getUserById(req.params.id);
    const after = await userService.updateUser(req.params.id, req.body);
    void auditService.record({
      action: 'user.update',
      resource: 'User',
      resourceId: after.id,
      before: { status: before.status, fullName: before.fullName },
      after: { status: after.status, fullName: after.fullName },
    }).catch(() => undefined);
    sendSuccess(res, after);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await userService.deleteUser(req.params.id);
    void auditService.record({
      action: 'user.delete',
      resource: 'User',
      resourceId: req.params.id,
    }).catch(() => undefined);
    sendSuccess(res, { deleted: true });
  },

  async suspend(req: Request, res: Response): Promise<void> {
    const user = await userService.suspendUser(req.params.id, req.body.reason);
    void auditService.record({
      action: 'user.suspend',
      resource: 'User',
      resourceId: user.id,
      after: { reason: req.body.reason },
    }).catch(() => undefined);
    sendSuccess(res, user);
  },

  async unsuspend(req: Request, res: Response): Promise<void> {
    const user = await userService.unsuspendUser(req.params.id);
    void auditService.record({
      action: 'user.unsuspend',
      resource: 'User',
      resourceId: user.id,
    }).catch(() => undefined);
    sendSuccess(res, user);
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await userService.getUserStats(req.params.id));
  },
} as const;
