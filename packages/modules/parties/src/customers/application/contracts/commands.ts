import { z } from "zod";

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const CreateCustomerInputSchema = z.object({
  externalRef: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  displayName: z.string().trim().min(1, "displayName is required"),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
});

export type CreateCustomerInput = z.input<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = z.object({
  externalRef: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  displayName: z.string().trim().min(1).exactOptional(),
  description: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
});

export type UpdateCustomerInput = z.input<typeof UpdateCustomerInputSchema>;
