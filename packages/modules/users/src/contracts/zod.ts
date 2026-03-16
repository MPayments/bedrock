import { z } from "zod";

import {
  USER_ROLE_VALUES,
  type UserRole as DomainUserRole,
} from "../domain/user-role";

export const UserRoleSchema = z.enum(USER_ROLE_VALUES);

export type UserRole = DomainUserRole;
