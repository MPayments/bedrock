import type { ListQueryContract } from "@bedrock/shared/core/pagination";

const REQUISITES_SORTABLE_COLUMNS = [
  "label",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface RequisitesListFilters {
  label: { kind: "string"; cardinality: "single" };
  ownerType: { kind: "string"; cardinality: "single" };
  ownerId: { kind: "string"; cardinality: "single" };
  currencyId: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  providerId: { kind: "string"; cardinality: "multi" };
}

export const REQUISITES_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITES_SORTABLE_COLUMNS,
  RequisitesListFilters
> = {
  sortableColumns: REQUISITES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    label: { kind: "string", cardinality: "single" },
    ownerType: { kind: "string", cardinality: "single" },
    ownerId: { kind: "string", cardinality: "single" },
    currencyId: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    providerId: { kind: "string", cardinality: "multi" },
  },
};
