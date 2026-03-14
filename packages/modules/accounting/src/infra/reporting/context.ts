import type { BalancesQueries } from "@bedrock/balances/queries";
import type { CounterpartiesQueries } from "@bedrock/counterparties/queries";
import type { LedgerQueries } from "@bedrock/ledger/queries";
import type { OrganizationsQueries } from "@bedrock/organizations/queries";

import type { AccountingReportsContext } from "../../application/reports/ports";
import type { AccountingReportsRepository } from "../drizzle/repos/reports-repository";
import { createReportsScopeHelpers } from "./query-support/scope";
import { createReportsSharedHelpers } from "./query-support/shared";

export function createAccountingReportsContext(input: {
  balancesQueries: BalancesQueries;
  counterpartiesQueries: CounterpartiesQueries;
  ledgerQueries: LedgerQueries;
  organizationsQueries: OrganizationsQueries;
  reportsRepository: AccountingReportsRepository;
}): AccountingReportsContext {
  const {
    balancesQueries,
    counterpartiesQueries,
    ledgerQueries,
    organizationsQueries,
    reportsRepository,
  } = input;

  return {
    ...createReportsSharedHelpers({
      balancesQueries,
      counterpartiesQueries,
      organizationsQueries,
      reportsRepository,
    }),
    ...createReportsScopeHelpers({
      counterpartiesQueries,
      ledgerQueries,
      organizationsQueries,
    }),
    assertInternalOrganization:
      organizationsQueries.assertInternalLedgerOrganization,
  };
}
