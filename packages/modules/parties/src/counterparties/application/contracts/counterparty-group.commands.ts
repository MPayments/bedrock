import { z } from "zod";

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const CreateCounterpartyGroupInputSchema = z.object({
  code: z.string().trim().min(1, "code is required"),
  name: z.string().trim().min(1, "name is required"),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  parentId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  customerId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
});

export type CreateCounterpartyGroupInput = z.input<
  typeof CreateCounterpartyGroupInputSchema
>;

export const UpdateCounterpartyGroupInputSchema = z.object({
  code: z.string().trim().min(1).exactOptional(),
  name: z.string().trim().min(1).exactOptional(),
  description: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  parentId: z.uuid().nullable().exactOptional(),
  customerId: z.uuid().nullable().exactOptional(),
});

export type UpdateCounterpartyGroupInput = z.input<
  typeof UpdateCounterpartyGroupInputSchema
>;
