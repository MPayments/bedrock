import { z } from "zod";

import {
    createListQuerySchemaFromContract,
    type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const UserRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

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

const USERS_SORTABLE_COLUMNS = [
    "name",
    "email",
    "role",
    "createdAt",
] as const;

interface UsersListFilters {
    name: { kind: "string"; cardinality: "single" };
    email: { kind: "string"; cardinality: "single" };
    role: { kind: "string"; cardinality: "multi" };
    banned: { kind: "boolean"; cardinality: "single" };
}

export const USERS_LIST_CONTRACT: ListQueryContract<
    typeof USERS_SORTABLE_COLUMNS,
    UsersListFilters
> = {
    sortableColumns: USERS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        name: { kind: "string", cardinality: "single" },
        email: { kind: "string", cardinality: "single" },
        role: { kind: "string", cardinality: "multi" },
        banned: { kind: "boolean", cardinality: "single" },
    },
};

export const ListUsersQuerySchema =
    createListQuerySchemaFromContract(USERS_LIST_CONTRACT);

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

export const CreateUserInputSchema = z.object({
    name: z.string().min(1, "name is required"),
    email: z.email("invalid email"),
    password: z.string().min(6, "password must be at least 6 characters"),
    role: UserRoleSchema.default("user"),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.email().optional(),
    role: UserRoleSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

export const ChangePasswordInputSchema = z.object({
    newPassword: z.string().min(6, "password must be at least 6 characters"),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const UpdateProfileInputSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.email().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const ChangeOwnPasswordInputSchema = z.object({
    currentPassword: z.string().min(1, "current password is required"),
    newPassword: z.string().min(6, "password must be at least 6 characters"),
});

export type ChangeOwnPasswordInput = z.infer<
    typeof ChangeOwnPasswordInputSchema
>;

export const BanUserInputSchema = z.object({
    banReason: z.string().optional(),
    banExpires: z.coerce.date().optional(),
});

export type BanUserInput = z.infer<typeof BanUserInputSchema>;
