import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import { TREASURY_OPERATION_KIND_VALUES } from "../../domain/operation-types";

export const TREASURY_OPERATION_VIEW_VALUES = [
  "incoming",
  "outgoing",
  "intracompany",
  "intercompany",
  "fx",
  "exceptions",
] as const;

export const TreasuryOperationViewSchema = z.enum(
  TREASURY_OPERATION_VIEW_VALUES,
);

const TREASURY_OPERATIONS_SORTABLE_COLUMNS = ["createdAt", "kind"] as const;

interface TreasuryOperationsListFilters {
  dealId: { kind: "string"; cardinality: "single" };
  internalEntityOrganizationId: { kind: "string"; cardinality: "single" };
  kind: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof TREASURY_OPERATION_KIND_VALUES;
  };
  view: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof TREASURY_OPERATION_VIEW_VALUES;
  };
}

export const TREASURY_OPERATIONS_LIST_CONTRACT: ListQueryContract<
  typeof TREASURY_OPERATIONS_SORTABLE_COLUMNS,
  TreasuryOperationsListFilters
> = {
  sortableColumns: TREASURY_OPERATIONS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    dealId: { kind: "string", cardinality: "single" },
    internalEntityOrganizationId: { kind: "string", cardinality: "single" },
    kind: {
      kind: "string",
      cardinality: "multi",
      enumValues: TREASURY_OPERATION_KIND_VALUES,
    },
    view: {
      kind: "string",
      cardinality: "single",
      enumValues: TREASURY_OPERATION_VIEW_VALUES,
    },
  },
};

export const ListTreasuryOperationsQuerySchema = createListQuerySchemaFromContract(
  TREASURY_OPERATIONS_LIST_CONTRACT,
);

export type TreasuryOperationView = z.infer<typeof TreasuryOperationViewSchema>;
export type ListTreasuryOperationsQuery = z.infer<
  typeof ListTreasuryOperationsQuerySchema
>;
