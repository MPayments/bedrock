import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/common/pagination";

export const CustomerSchema = z.object({
  id: z.uuid(),
  externalRef: z.string().nullable(),
  displayName: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Customer = z.infer<typeof CustomerSchema>;

const CUSTOMERS_SORTABLE_COLUMNS = [
  "displayName",
  "externalRef",
  "createdAt",
  "updatedAt",
] as const;

interface CustomersListFilters {
  displayName: { kind: "string"; cardinality: "single" };
  externalRef: { kind: "string"; cardinality: "single" };
}

export const CUSTOMERS_LIST_CONTRACT: ListQueryContract<
  typeof CUSTOMERS_SORTABLE_COLUMNS,
  CustomersListFilters
> = {
  sortableColumns: CUSTOMERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    displayName: { kind: "string", cardinality: "single" },
    externalRef: { kind: "string", cardinality: "single" },
  },
};

export const ListCustomersQuerySchema = createListQuerySchemaFromContract(
  CUSTOMERS_LIST_CONTRACT,
);

export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

export const CreateCustomerInputSchema = z.object({
  externalRef: z.string().optional(),
  displayName: z.string().min(1, "displayName is required"),
  description: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = z.object({
  externalRef: z.string().nullable().optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;
