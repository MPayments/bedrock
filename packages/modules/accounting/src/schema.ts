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
  accountingPeriodLocks,
} from "./periods/adapters/drizzle/schema";
import {
  accountingReportLineMappings,
} from "./reports/adapters/drizzle/schema";

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
