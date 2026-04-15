import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  TREASURY_OPERATION_FACT_SOURCE_KIND_VALUES,
  TREASURY_OPERATION_KIND_VALUES,
} from "../../domain/operation-types";

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

interface TreasuryExecutionActualsListFilters {
  dealId: { kind: "string"; cardinality: "single" };
  operationId: { kind: "string"; cardinality: "single" };
  routeLegId: { kind: "string"; cardinality: "single" };
  sourceKind: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof TREASURY_OPERATION_FACT_SOURCE_KIND_VALUES;
  };
}

const TREASURY_EXECUTION_FILLS_SORTABLE_COLUMNS = [
  "executedAt",
  "createdAt",
] as const;

export const TREASURY_EXECUTION_FILLS_LIST_CONTRACT: ListQueryContract<
  typeof TREASURY_EXECUTION_FILLS_SORTABLE_COLUMNS,
  TreasuryExecutionActualsListFilters
> = {
  sortableColumns: TREASURY_EXECUTION_FILLS_SORTABLE_COLUMNS,
  defaultSort: { id: "executedAt", desc: true },
  filters: {
    dealId: { kind: "string", cardinality: "single" },
    operationId: { kind: "string", cardinality: "single" },
    routeLegId: { kind: "string", cardinality: "single" },
    sourceKind: {
      kind: "string",
      cardinality: "multi",
      enumValues: TREASURY_OPERATION_FACT_SOURCE_KIND_VALUES,
    },
  },
};

export const ListTreasuryExecutionFillsQuerySchema =
  createListQuerySchemaFromContract(TREASURY_EXECUTION_FILLS_LIST_CONTRACT);

const TREASURY_EXECUTION_FEES_SORTABLE_COLUMNS = [
  "chargedAt",
  "createdAt",
] as const;

export const TREASURY_EXECUTION_FEES_LIST_CONTRACT: ListQueryContract<
  typeof TREASURY_EXECUTION_FEES_SORTABLE_COLUMNS,
  TreasuryExecutionActualsListFilters
> = {
  sortableColumns: TREASURY_EXECUTION_FEES_SORTABLE_COLUMNS,
  defaultSort: { id: "chargedAt", desc: true },
  filters: TREASURY_EXECUTION_FILLS_LIST_CONTRACT.filters,
};

export const ListTreasuryExecutionFeesQuerySchema =
  createListQuerySchemaFromContract(TREASURY_EXECUTION_FEES_LIST_CONTRACT);

const TREASURY_CASH_MOVEMENTS_SORTABLE_COLUMNS = [
  "bookedAt",
  "createdAt",
] as const;

export const TREASURY_CASH_MOVEMENTS_LIST_CONTRACT: ListQueryContract<
  typeof TREASURY_CASH_MOVEMENTS_SORTABLE_COLUMNS,
  TreasuryExecutionActualsListFilters
> = {
  sortableColumns: TREASURY_CASH_MOVEMENTS_SORTABLE_COLUMNS,
  defaultSort: { id: "bookedAt", desc: true },
  filters: TREASURY_EXECUTION_FILLS_LIST_CONTRACT.filters,
};

export const ListTreasuryCashMovementsQuerySchema =
  createListQuerySchemaFromContract(TREASURY_CASH_MOVEMENTS_LIST_CONTRACT);

export type TreasuryOperationView = z.infer<typeof TreasuryOperationViewSchema>;
export type ListTreasuryOperationsQuery = z.infer<
  typeof ListTreasuryOperationsQuerySchema
>;
export type ListTreasuryExecutionFillsQuery = z.infer<
  typeof ListTreasuryExecutionFillsQuerySchema
>;
export type ListTreasuryExecutionFeesQuery = z.infer<
  typeof ListTreasuryExecutionFeesQuerySchema
>;
export type ListTreasuryCashMovementsQuery = z.infer<
  typeof ListTreasuryCashMovementsQuerySchema
>;
