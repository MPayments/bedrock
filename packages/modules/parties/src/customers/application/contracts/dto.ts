import { z } from "zod";

import { createPaginatedListSchema, type PaginatedList } from "@bedrock/shared/core/pagination";

export const CustomerSchema = z.object({
  id: z.uuid(),
  externalRef: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CustomerOptionSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  name: z.string(),
});

export const CustomerOptionsResponseSchema = z.object({
  data: z.array(CustomerOptionSchema),
});

export type Customer = z.output<typeof CustomerSchema>;
export const PaginatedCustomersSchema = createPaginatedListSchema(CustomerSchema);
export type PaginatedCustomers = PaginatedList<Customer>;
export type CustomerOption = z.output<typeof CustomerOptionSchema>;
