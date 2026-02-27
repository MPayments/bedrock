export {
  ACCOUNT_NO,
  CLEARING_KIND,
  DIM,
  KNOWN_DIMENSION_KEYS,
  CLEARING_KIND_DIMENSION_RULES,
  OPERATION_CODE,
  POSTING_CODE,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_ACCOUNT_DIMENSION_POLICIES,
  DEFAULT_POSTING_CODE_DIMENSION_POLICIES,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
  type AccountDimensionPolicy,
  type PostingCodeDimensionPolicyEntry,
  type ClearingKindDimensionRule,
  type DimensionMode,
  type DimensionPolicyScope,
  type DimensionKey,
  type Dimensions,
} from "./constants";

export {
  ACCOUNTING_OPERATIONS_LIST_CONTRACT,
  ListAccountingOperationsQuerySchema,
  accountNoSchema,
  correspondenceRuleSchema,
  replaceCorrespondenceRulesSchema,
  type ListAccountingOperationsQuery,
  type ReplaceCorrespondenceRulesInput,
} from "./validation";

export { AccountingError, CorrespondenceRuleNotFoundError } from "./errors";

export { createAccountingService, type AccountingService } from "./service";

export {
  OPERATION_TRANSFER_TYPE,
  buildTransferApproveTemplate,
  buildTransferPendingActionTemplate,
  resolveInLedgerFeePostingTemplate,
  resolveFeeReservePostingTemplate,
  resolveProviderFeeExpenseAccrualPostingTemplate,
  resolveAdjustmentInLedgerPostingTemplate,
  resolveAdjustmentReservePostingTemplate,
  type CreateIntentLine,
  type PostPendingIntentLine,
  type VoidPendingIntentLine,
  type IntentLine,
  type TransferPostingBinding,
  type TransferApproveTemplateInput,
  type TransferApproveTemplateResult,
  type TransferPendingActionTemplateInput,
  type TransferPendingActionTemplateResult,
  type FeePostingTemplate,
} from "./templates";

export type { AccountingServiceDeps } from "./internal/context";
