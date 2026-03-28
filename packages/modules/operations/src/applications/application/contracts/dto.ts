import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { APPLICATION_STATUS_VALUES } from "../../domain/application-status";

export const ApplicationSchema = z.object({
  id: z.number().int(),
  agentId: z.string().nullable(),
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

export const ApplicationListRowSchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  client: z.string(),
  clientId: z.number().int(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  hasCalculation: z.boolean(),
  agentName: z.string(),
  comment: z.string().nullable(),
  status: z.enum(APPLICATION_STATUS_VALUES),
});

export type ApplicationListRow = z.infer<typeof ApplicationListRowSchema>;

export const PaginatedApplicationListRowsSchema =
  createPaginatedListSchema(ApplicationListRowSchema);

export type PaginatedApplicationListRows = z.infer<
  typeof PaginatedApplicationListRowsSchema
>;
