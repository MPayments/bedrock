import { z } from "zod";

import { UserRoleSchema } from "./zod";

export const CreateUserInputSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.email("invalid email"),
  password: z.string().min(6, "password must be at least 6 characters"),
  role: UserRoleSchema.default("user"),
});

export type CreateUserInput = z.input<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  name: z.string().trim().min(1).exactOptional(),
  email: z.email().exactOptional(),
  role: UserRoleSchema.exactOptional(),
});

export type UpdateUserInput = z.input<typeof UpdateUserInputSchema>;

export const ChangePasswordInputSchema = z.object({
  newPassword: z.string().min(6, "password must be at least 6 characters"),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().trim().min(1).exactOptional(),
  email: z.email().exactOptional(),
});

export type UpdateProfileInput = z.input<typeof UpdateProfileInputSchema>;

export const ChangeOwnPasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "current password is required"),
  newPassword: z.string().min(6, "password must be at least 6 characters"),
});

export type ChangeOwnPasswordInput = z.infer<
  typeof ChangeOwnPasswordInputSchema
>;

export const BanUserInputSchema = z.object({
  banReason: z.string().trim().exactOptional(),
  banExpires: z.coerce.date().exactOptional(),
});

export type BanUserInput = z.input<typeof BanUserInputSchema>;
