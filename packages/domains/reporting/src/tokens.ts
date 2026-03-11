import { token } from "@bedrock/core";
import type { DimensionRegistry } from "@multihansa/common/registers";
import type { AccountingReportingService } from "@multihansa/reporting/accounting-reporting";

export const AccountingReportingDomainServiceToken =
  token<AccountingReportingService>(
    "multihansa.reporting.accounting-reporting-domain-service",
  );

export const DimensionRegistryToken = token<DimensionRegistry>(
  "multihansa.reporting.dimension-registry",
);
