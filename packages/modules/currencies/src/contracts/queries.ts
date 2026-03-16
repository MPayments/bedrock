import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const CURRENCIES_SORTABLE_COLUMNS = [
  "code",
  "name",
  "symbol",
  "precision",
  "createdAt",
  "updatedAt",
] as const;

interface CurrenciesListFilters {
  name: { kind: "string"; cardinality: "single" };
  code: { kind: "string"; cardinality: "single" };
  symbol: { kind: "string"; cardinality: "single" };
  precision: { kind: "number"; cardinality: "single"; int: true; min: 0 };
}

export const CURRENCIES_LIST_CONTRACT: ListQueryContract<
  typeof CURRENCIES_SORTABLE_COLUMNS,
  CurrenciesListFilters
> = {
  sortableColumns: CURRENCIES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    name: { kind: "string", cardinality: "single" },
    code: { kind: "string", cardinality: "single" },
    symbol: { kind: "string", cardinality: "single" },
    precision: { kind: "number", cardinality: "single", int: true, min: 0 },
  },
};

export const ListCurrenciesQuerySchema = createListQuerySchemaFromContract(
  CURRENCIES_LIST_CONTRACT,
);

export type ListCurrenciesQuery = z.infer<typeof ListCurrenciesQuerySchema>;
