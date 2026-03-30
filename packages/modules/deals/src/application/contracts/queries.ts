import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const DEALS_SORTABLE_COLUMNS = [
  "createdAt",
  "updatedAt",
  "status",
  "type",
] as const;

interface DealsListFilters {
  agreementId: { kind: "string"; cardinality: "single" };
  calculationId: { kind: "string"; cardinality: "single" };
  customerId: { kind: "string"; cardinality: "single" };
  status: { kind: "string"; cardinality: "single" };
  type: { kind: "string"; cardinality: "single" };
}

export const DEALS_LIST_CONTRACT: ListQueryContract<
  typeof DEALS_SORTABLE_COLUMNS,
  DealsListFilters
> = {
  sortableColumns: DEALS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    agreementId: { kind: "string", cardinality: "single" },
    calculationId: { kind: "string", cardinality: "single" },
    customerId: { kind: "string", cardinality: "single" },
    status: { kind: "string", cardinality: "single" },
    type: { kind: "string", cardinality: "single" },
  },
};

export const ListDealsQuerySchema = createListQuerySchemaFromContract(
  DEALS_LIST_CONTRACT,
);

export type ListDealsQuery = z.infer<typeof ListDealsQuerySchema>;
