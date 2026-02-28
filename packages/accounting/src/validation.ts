import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/kernel/pagination";

export const accountNoSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, "accountNo must match NNNN");

export const correspondenceRuleSchema = z.object({
  postingCode: z.string().min(1).max(128),
  debitAccountNo: accountNoSchema,
  creditAccountNo: accountNoSchema,
  enabled: z.boolean().default(true),
});

export const replaceCorrespondenceRulesSchema = z.object({
  rules: z.array(correspondenceRuleSchema),
});

const ACCOUNTING_OPERATIONS_SORTABLE_COLUMNS = [
  "createdAt",
  "postingDate",
  "postedAt",
] as const;

interface AccountingOperationsListFilters {
  query: { kind: "string"; cardinality: "single" };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: readonly ["pending", "posted", "failed"];
  };
  operationCode: { kind: "string"; cardinality: "multi" };
  sourceType: { kind: "string"; cardinality: "multi" };
  sourceId: { kind: "string"; cardinality: "single" };
  bookOrgId: { kind: "string"; cardinality: "single" };
  counterpartyId: { kind: "string"; cardinality: "single" };
}

export const ACCOUNTING_OPERATIONS_LIST_CONTRACT: ListQueryContract<
  typeof ACCOUNTING_OPERATIONS_SORTABLE_COLUMNS,
  AccountingOperationsListFilters
> = {
  sortableColumns: ACCOUNTING_OPERATIONS_SORTABLE_COLUMNS,
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
    bookOrgId: {
      kind: "string",
      cardinality: "single",
    },
    counterpartyId: {
      kind: "string",
      cardinality: "single",
    },
  },
};

export const ListAccountingOperationsQuerySchema =
  createListQuerySchemaFromContract(ACCOUNTING_OPERATIONS_LIST_CONTRACT);

export type CorrespondenceRuleInput = z.infer<typeof correspondenceRuleSchema>;
export type ReplaceCorrespondenceRulesInput = z.infer<
  typeof replaceCorrespondenceRulesSchema
>;
export type ListAccountingOperationsQuery = z.infer<
  typeof ListAccountingOperationsQuerySchema
>;
