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
} from "./chart/adapters/drizzle/schema";
import {
  accountingClosePackages,
} from "./periods/adapters/drizzle/close-packages.schema";
import {
  accountingPeriodLocks,
} from "./periods/adapters/drizzle/period-locks.schema";
import {
  accountingReportLineMappings,
} from "./reports/adapters/drizzle/report-line-mappings.schema";

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

export const schema = {
  chartAccountKindEnum,
  chartNormalSideEnum,
  dimensionModeEnum,
  dimensionPolicyScopeEnum,
  chartTemplateAccounts,
  chartAccountDimensionPolicy,
  postingCodeDimensionPolicy,
  correspondenceRules,
  accountingPackVersions,
  accountingPackAssignments,
  accountingPeriodLocks,
  accountingClosePackages,
  accountingReportLineMappings,
};
