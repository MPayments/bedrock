import { z } from "zod";

export const CreateBookInputSchema = z.object({
  counterpartyId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  isDefault: z.boolean().optional(),
});

export const ListBooksByCounterpartyInputSchema = z.object({
  counterpartyId: z.uuid(),
});

export const ResolveOperationalAccountBookInputSchema = z.object({
  operationalAccountId: z.uuid(),
});

export type CreateBookInput = z.infer<typeof CreateBookInputSchema>;
export type ListBooksByCounterpartyInput = z.infer<
  typeof ListBooksByCounterpartyInputSchema
>;
export type ResolveOperationalAccountBookInput = z.infer<
  typeof ResolveOperationalAccountBookInputSchema
>;
