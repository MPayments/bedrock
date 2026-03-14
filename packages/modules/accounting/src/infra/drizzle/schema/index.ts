import {
  accountingPackAssignments,
  accountingPackVersions,
  chartAccountDimensionPolicy,
  chartAccountKindEnum,
  chartNormalSideEnum,
  chartTemplateAccounts,
  correspondenceRules,
  dimensionModeEnum,
  dimensionPolicyScopeEnum,
  postingCodeDimensionPolicy,
} from "./accounting";
import {
  accountingClosePackages,
  type AccountingClosePackage,
  type AccountingClosePackageState,
} from "./close-packages";
import {
  accountingPeriodLocks,
  type AccountingPeriodLock,
  type AccountingPeriodLockInsert,
  type AccountingPeriodState,
} from "./period-locks";
import {
  accountingReportLineMappings,
  type AccountingReportKind,
  type AccountingReportLineMapping,
} from "./report-line-mappings";

export const schema = {
  chartTemplateAccounts,
  chartAccountDimensionPolicy,
  postingCodeDimensionPolicy,
  correspondenceRules,
  accountingPackVersions,
  accountingPackAssignments,
  accountingReportLineMappings,
  accountingPeriodLocks,
  accountingClosePackages,
};

export {
  accountingClosePackages,
  accountingPackAssignments,
  accountingPackVersions,
  accountingPeriodLocks,
  accountingReportLineMappings,
  chartAccountDimensionPolicy,
  chartAccountKindEnum,
  chartNormalSideEnum,
  chartTemplateAccounts,
  correspondenceRules,
  dimensionModeEnum,
  dimensionPolicyScopeEnum,
  postingCodeDimensionPolicy,
};

export type {
  AccountingClosePackage,
  AccountingClosePackageState,
  AccountingPeriodLock,
  AccountingPeriodLockInsert,
  AccountingPeriodState,
  AccountingReportKind,
  AccountingReportLineMapping,
};

export type {
  AccountingPackAssignment,
  AccountingPackVersion,
  ChartAccountDimensionPolicyRow,
  ChartTemplateAccount,
  CorrespondenceRule,
  PostingCodeDimensionPolicyRow,
} from "./accounting";
