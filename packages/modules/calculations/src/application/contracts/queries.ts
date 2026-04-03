import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const CALCULATIONS_SORTABLE_COLUMNS = [
  "createdAt",
  "updatedAt",
  "calculationTimestamp",
] as const;

interface CalculationsListFilters {
  isActive: { kind: "boolean"; cardinality: "single" };
}

export const CALCULATIONS_LIST_CONTRACT: ListQueryContract<
  typeof CALCULATIONS_SORTABLE_COLUMNS,
  CalculationsListFilters
> = {
  sortableColumns: CALCULATIONS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    isActive: { kind: "boolean", cardinality: "single" },
  },
};

export const ListCalculationsQuerySchema = createListQuerySchemaFromContract(
  CALCULATIONS_LIST_CONTRACT,
);

export type ListCalculationsQuery = z.infer<
  typeof ListCalculationsQuerySchema
>;
