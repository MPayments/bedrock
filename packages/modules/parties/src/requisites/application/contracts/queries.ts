import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const REQUISITE_PROVIDERS_SORTABLE_COLUMNS = [
  "name",
  "kind",
  "country",
  "createdAt",
  "updatedAt",
] as const;

interface RequisiteProvidersListFilters {
  kind: { kind: "string"; cardinality: "multi" };
  country: { kind: "string"; cardinality: "multi" };
  name: { kind: "string"; cardinality: "single" };
  bic: { kind: "string"; cardinality: "multi" };
  swift: { kind: "string"; cardinality: "multi" };
}

export const REQUISITE_PROVIDERS_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  RequisiteProvidersListFilters
> = {
  sortableColumns: REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    bic: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    country: { kind: "string", cardinality: "multi" },
    name: { kind: "string", cardinality: "single" },
    swift: { kind: "string", cardinality: "multi" },
  },
};

export const ListRequisiteProvidersQuerySchema =
  createListQuerySchemaFromContract(REQUISITE_PROVIDERS_LIST_CONTRACT);

export type ListRequisiteProvidersQuery = z.infer<
  typeof ListRequisiteProvidersQuerySchema
>;
