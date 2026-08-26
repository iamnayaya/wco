import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@wco/shared';

export const ROLES_KEY = 'wco:roles';

/** Restrict a route to the given roles (checked by RolesGuard). */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
