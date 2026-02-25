export {
  ACCOUNT_NO,
  OPERATION_CODE,
  POSTING_CODE,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
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

export type { AccountingServiceDeps } from "./internal/context";
