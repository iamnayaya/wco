import { USER_ROLES } from '@wco/shared';
import { z } from 'zod';

/** Team management DTOs - merchant-scoped user administration. */

export const createUserSchema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().min(2).max(120),
  role: z.enum(USER_ROLES).default('AGENT'),
  temporaryPassword: z.string().min(8).max(128),
});

export const updateRoleSchema = z.object({ role: z.enum(USER_ROLES) });

export const updateStatusSchema = z.object({ isActive: z.boolean() });

export const idParams = z.object({ id: z.string().min(1) });

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type IdParams = z.infer<typeof idParams>;
