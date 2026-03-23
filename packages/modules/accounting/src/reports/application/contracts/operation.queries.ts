import { z } from "zod";

import { ReportUuidSchema } from "./zod";

export const GetOperationDetailsWithLabelsInputSchema = ReportUuidSchema;

export const ListOperationDetailsWithLabelsInputSchema = z.array(
  ReportUuidSchema,
);

export const ListOperationsWithLabelsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["createdAt", "postingDate", "postedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  query: z.string().trim().min(1).optional(),
  status: z.array(z.enum(["pending", "posted", "failed"])).min(1).optional(),
  operationCode: z.array(z.string().trim().min(1)).min(1).optional(),
  sourceType: z.array(z.string().trim().min(1)).min(1).optional(),
  sourceId: z.string().trim().min(1).optional(),
  bookId: z.string().trim().min(1).optional(),
  dimensionFilters: z
    .record(z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1))
    .optional(),
});

export type GetOperationDetailsWithLabelsInput = z.infer<
  typeof GetOperationDetailsWithLabelsInputSchema
>;
export type ListOperationDetailsWithLabelsInput = z.infer<
  typeof ListOperationDetailsWithLabelsInputSchema
>;
export type ListOperationsWithLabelsQuery = z.infer<
  typeof ListOperationsWithLabelsQuerySchema
>;
