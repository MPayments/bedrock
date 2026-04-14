import { z } from "zod";

type RoleValues = readonly [string, ...string[]];

function toRoleTuple(values: readonly string[]): RoleValues {
  if (values.length === 0) {
    throw new Error("roleValues must contain at least one value");
  }
  return values as unknown as RoleValues;
}

export function createCreateUserFormSchema(roleValues: readonly string[]) {
  const tuple = toRoleTuple(roleValues);
  return z.object({
    name: z.string().trim().min(1, "Имя обязательно"),
    email: z.email("Некорректный email"),
    password: z.string().min(6, "Минимум 6 символов"),
    role: z.enum(tuple),
  });
}

export type CreateUserFormValues = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export function createUserGeneralFormSchema(roleValues: readonly string[]) {
  const tuple = toRoleTuple(roleValues);
  return z.object({
    name: z.string().trim().min(1, "Имя обязательно"),
    email: z.email("Некорректный email"),
    role: z.enum(tuple),
  });
}

export type UserGeneralFormValues = {
  name: string;
  email: string;
  role: string;
};

export const ChangePasswordSchema = z.object({
  newPassword: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

export const BanUserFormSchema = z.object({
  banReason: z.string().optional(),
  banExpires: z
    .string()
    .optional()
    .refine(
      (val) => !val || new Date(val) > new Date(),
      "Дата должна быть в будущем",
    ),
});

export type BanUserFormValues = z.infer<typeof BanUserFormSchema>;
