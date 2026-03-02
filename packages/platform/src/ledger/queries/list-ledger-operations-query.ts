import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/foundation/kernel/pagination";

const LEDGER_OPERATIONS_SORTABLE_COLUMNS = [
  "createdAt",
  "postingDate",
  "postedAt",
] as const;

interface LedgerOperationsListFilters {
  query: { kind: "string"; cardinality: "single" };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: readonly ["pending", "posted", "failed"];
  };
  operationCode: { kind: "string"; cardinality: "multi" };
  sourceType: { kind: "string"; cardinality: "multi" };
  sourceId: { kind: "string"; cardinality: "single" };
  bookId: { kind: "string"; cardinality: "single" };
  counterpartyId: { kind: "string"; cardinality: "single" };
}

const LEDGER_OPERATIONS_LIST_CONTRACT: ListQueryContract<
  typeof LEDGER_OPERATIONS_SORTABLE_COLUMNS,
  LedgerOperationsListFilters
> = {
  sortableColumns: LEDGER_OPERATIONS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    query: {
      kind: "string",
      cardinality: "single",
    },
    status: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["pending", "posted", "failed"],
    },
    operationCode: {
      kind: "string",
      cardinality: "multi",
    },
    sourceType: {
      kind: "string",
      cardinality: "multi",
    },
    sourceId: {
      kind: "string",
      cardinality: "single",
    },
    bookId: {
      kind: "string",
      cardinality: "single",
    },
    counterpartyId: {
      kind: "string",
      cardinality: "single",
    },
  },
};

export const ListLedgerOperationsQuerySchema = createListQuerySchemaFromContract(
  LEDGER_OPERATIONS_LIST_CONTRACT,
);

export type ListLedgerOperationsQuery = z.infer<
  typeof ListLedgerOperationsQuerySchema
>;
