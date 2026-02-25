export {
  ACCOUNT_NO,
  OPERATION_CODE,
  POSTING_CODE,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_CHART_TEMPLATE_ACCOUNT_ANALYTICS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
} from "./constants";

export {
  accountNoSchema,
  correspondenceRuleSchema,
  replaceCorrespondenceRulesSchema,
  upsertOrgAccountOverrideSchema,
  type ReplaceCorrespondenceRulesInput,
  type UpsertOrgAccountOverrideInput,
} from "./validation";

export {
  AccountingError,
  CorrespondenceRuleNotFoundError,
} from "./errors";

export {
  createAccountingService,
  type AccountingService,
} from "./service";

export {
  OPERATION_TRANSFER_TYPE,
  buildTransferApproveTemplate,
  buildTransferPendingActionTemplate,
  resolveInLedgerFeePostingTemplate,
  resolveFeeReservePostingTemplate,
  resolveAdjustmentInLedgerPostingTemplate,
  resolveAdjustmentReservePostingTemplate,
  type PostingAnalytics,
  type CreateOperationTransferLine,
  type PostPendingOperationTransferLine,
  type VoidPendingOperationTransferLine,
  type OperationTransferLine,
  type TransferPostingBinding,
  type TransferApproveTemplateInput,
  type TransferApproveTemplateResult,
  type TransferPendingActionTemplateInput,
  type TransferPendingActionTemplateResult,
  type FeePostingTemplate,
} from "./templates";

export type { AccountingServiceDeps } from "./internal/context";
