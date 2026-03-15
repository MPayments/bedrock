import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const FX_QUOTES_SORTABLE_COLUMNS = [
  "createdAt",
  "expiresAt",
  "usedAt",
  "status",
  "pricingMode",
] as const;

interface FxQuotesListFilters {
  idempotencyKey: { kind: "string"; cardinality: "single" };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: ["active", "used", "expired", "cancelled"];
  };
  pricingMode: {
    kind: "string";
    cardinality: "multi";
    enumValues: ["auto_cross", "explicit_route"];
  };
}

export const FX_QUOTES_LIST_CONTRACT: ListQueryContract<
  typeof FX_QUOTES_SORTABLE_COLUMNS,
  FxQuotesListFilters
> = {
  sortableColumns: FX_QUOTES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    idempotencyKey: { kind: "string", cardinality: "single" },
    status: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["active", "used", "expired", "cancelled"],
    },
    pricingMode: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["auto_cross", "explicit_route"],
    },
  },
};

export const ListFxQuotesQuerySchema = createListQuerySchemaFromContract(
  FX_QUOTES_LIST_CONTRACT,
);
