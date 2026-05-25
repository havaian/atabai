import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../../users/schemas/user.schema';

export const ROLES_KEY = 'roles';
/** Restrict a route or controller to the listed roles. Pair with RolesGuard. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
