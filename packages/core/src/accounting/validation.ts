import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/kernel/pagination";

import { LEDGER_OPERATIONS_LIST_CONTRACT } from "../ledger/queries/operations-list-contract";

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

export const ACCOUNTING_OPERATIONS_LIST_CONTRACT: ListQueryContract<
  (typeof LEDGER_OPERATIONS_LIST_CONTRACT)["sortableColumns"],
  (typeof LEDGER_OPERATIONS_LIST_CONTRACT)["filters"]
> = LEDGER_OPERATIONS_LIST_CONTRACT;

export const ListAccountingOperationsQuerySchema =
  createListQuerySchemaFromContract(ACCOUNTING_OPERATIONS_LIST_CONTRACT);

export type CorrespondenceRuleInput = z.infer<typeof correspondenceRuleSchema>;
export type ReplaceCorrespondenceRulesInput = z.infer<
  typeof replaceCorrespondenceRulesSchema
>;
export type ListAccountingOperationsQuery = z.infer<
  typeof ListAccountingOperationsQuerySchema
>;
