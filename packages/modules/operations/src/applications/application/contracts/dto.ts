import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { APPLICATION_STATUS_VALUES } from "../../domain/application-status";

export const ApplicationSchema = z.object({
  id: z.number().int(),
  agentId: z.number().int().nullable(),
  clientId: z.number().int(),
  status: z.enum(APPLICATION_STATUS_VALUES),
  reason: z.string().nullable(),
  comment: z.string().nullable(),
  requestedAmount: z.string().nullable(),
  requestedCurrency: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Application = z.infer<typeof ApplicationSchema>;

export const PaginatedApplicationsSchema =
  createPaginatedListSchema(ApplicationSchema);

export type PaginatedApplications = z.infer<
  typeof PaginatedApplicationsSchema
>;
