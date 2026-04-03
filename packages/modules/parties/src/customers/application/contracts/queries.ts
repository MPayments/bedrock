import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

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
