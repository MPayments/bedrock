import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const COUNTERPARTIES_SORTABLE_COLUMNS = [
  "shortName",
  "fullName",
  "country",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface CounterpartiesListFilters {
  customerId: { kind: "string"; cardinality: "single" };
  externalId: { kind: "string"; cardinality: "single" };
  relationshipKind: { kind: "string"; cardinality: "multi" };
  shortName: { kind: "string"; cardinality: "single" };
  fullName: { kind: "string"; cardinality: "single" };
  country: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  groupIds: { kind: "string"; cardinality: "multi" };
}

export const COUNTERPARTIES_LIST_CONTRACT: ListQueryContract<
  typeof COUNTERPARTIES_SORTABLE_COLUMNS,
  CounterpartiesListFilters
> = {
  sortableColumns: COUNTERPARTIES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    customerId: { kind: "string", cardinality: "single" },
    externalId: { kind: "string", cardinality: "single" },
    relationshipKind: { kind: "string", cardinality: "multi" },
    shortName: { kind: "string", cardinality: "single" },
    fullName: { kind: "string", cardinality: "single" },
    country: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    groupIds: { kind: "string", cardinality: "multi" },
  },
};

export const ListCounterpartiesQuerySchema = createListQuerySchemaFromContract(
  COUNTERPARTIES_LIST_CONTRACT,
);

export type ListCounterpartiesQuery = z.infer<
  typeof ListCounterpartiesQuerySchema
>;
