import type { AdminProfile, SellerProfile } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import type { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import type { adminProfileUpsertSchema, sellerProfileCreateSchema, sellerProfileUpdateSchema } from '../user-management.dto.js';

type SellerProfileCreate = z.infer<typeof sellerProfileCreateSchema>;
type SellerProfileUpdate = z.infer<typeof sellerProfileUpdateSchema>;
type AdminProfileUpsert = z.infer<typeof adminProfileUpsertSchema>;

/**
 * 1:1 profile services. Profiles never create Users - they decorate them,
 * which keeps auth flows independent of commerce metadata.
 */

export class SellerProfileService {
  async createSellerProfile(userId: string, data: SellerProfileCreate): Promise<SellerProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictError('Seller profile already exists');
    return prisma.sellerProfile.create({ data: { userId, ...data, socials: data.socials ?? {} } });
  }

  async getSellerProfileByUserId(userId: string): Promise<SellerProfile> {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Seller profile not found');
    return profile;
  }

  async updateSellerProfile(userId: string, data: SellerProfileUpdate): Promise<SellerProfile> {
    await this.getSellerProfileByUserId(userId);
    return prisma.sellerProfile.update({ where: { userId }, data });
  }

  async deleteSellerProfile(userId: string): Promise<void> {
    await this.getSellerProfileByUserId(userId);
    await prisma.sellerProfile.delete({ where: { userId } });
  }
}

export class AdminProfileService {
  /** Staff provisioning pairs a User (role ADMIN) with its platform profile. */
  async createAdminProfile(userId: string, data: AdminProfileUpsert): Promise<AdminProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ConflictError('Admin profiles require the ADMIN role');
    }
    const existing = await prisma.adminProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictError('Admin profile already exists');
    return prisma.adminProfile.create({ data: { userId, permissions: data.permissions, title: data.title, department: data.department } });
  }

  async getAdminProfileByUserId(userId: string): Promise<AdminProfile> {
    const profile = await prisma.adminProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Admin profile not found');
    return profile;
  }

  async updateAdminProfile(userId: string, data: Partial<AdminProfileUpsert>): Promise<AdminProfile> {
    await this.getAdminProfileByUserId(userId);
    return prisma.adminProfile.update({ where: { userId }, data });
  }

  async deleteAdminProfile(userId: string): Promise<void> {
    await this.getAdminProfileByUserId(userId);
    await prisma.adminProfile.delete({ where: { userId } });
  }
}

export const sellerProfileService = new SellerProfileService();
export const adminProfileService = new AdminProfileService();
