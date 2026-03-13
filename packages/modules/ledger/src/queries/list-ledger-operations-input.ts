import { z } from "zod";

const ledgerOperationStatusSchema = z.enum(["pending", "posted", "failed"]);
const sortableColumnSchema = z.enum(["createdAt", "postingDate", "postedAt"]);
const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).min(1);

export const ListLedgerOperationsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: sortableColumnSchema.default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  query: nonEmptyStringSchema.optional(),
  status: z.array(ledgerOperationStatusSchema).min(1).optional(),
  operationCode: nonEmptyStringArraySchema.optional(),
  sourceType: nonEmptyStringArraySchema.optional(),
  sourceId: nonEmptyStringSchema.optional(),
  bookId: nonEmptyStringSchema.optional(),
  dimensionFilters: z
    .record(nonEmptyStringSchema, nonEmptyStringArraySchema)
    .optional(),
});

export type ListLedgerOperationsInput = z.infer<
  typeof ListLedgerOperationsInputSchema
>;
