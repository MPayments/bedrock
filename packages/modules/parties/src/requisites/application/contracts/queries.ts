import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const REQUISITE_PROVIDERS_SORTABLE_COLUMNS = [
  "displayName",
  "kind",
  "country",
  "createdAt",
  "updatedAt",
] as const;

interface RequisiteProvidersListFilters {
  kind: { kind: "string"; cardinality: "multi" };
  country: { kind: "string"; cardinality: "multi" };
  displayName: { kind: "string"; cardinality: "single" };
  legalName: { kind: "string"; cardinality: "single" };
}

export const REQUISITE_PROVIDERS_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  RequisiteProvidersListFilters
> = {
  sortableColumns: REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    kind: { kind: "string", cardinality: "multi" },
    country: { kind: "string", cardinality: "multi" },
    displayName: { kind: "string", cardinality: "single" },
    legalName: { kind: "string", cardinality: "single" },
  },
};

export const ListRequisiteProvidersQuerySchema =
  createListQuerySchemaFromContract(REQUISITE_PROVIDERS_LIST_CONTRACT);

export type ListRequisiteProvidersQuery = z.infer<
  typeof ListRequisiteProvidersQuerySchema
>;
