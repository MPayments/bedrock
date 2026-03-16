import { z } from "zod";

import { UserRoleSchema } from "./zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: UserRoleSchema.nullable(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: z.date().nullable(),
  twoFactorEnabled: z.boolean().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const UserWithLastSessionSchema = UserSchema.extend({
  lastSessionAt: z.date().nullable(),
  lastSessionIp: z.string().nullable(),
});

export type UserWithLastSession = z.infer<typeof UserWithLastSessionSchema>;
