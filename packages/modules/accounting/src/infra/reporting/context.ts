import type { BalancesQueries } from "@bedrock/balances/queries";
import type { CounterpartiesQueries } from "@bedrock/counterparties/queries";
import type { LedgerQueries } from "@bedrock/ledger/queries";
import type { OrganizationsQueries } from "@bedrock/organizations/queries";

import { createReportsScopeHelpers } from "./query-support/scope";
import { createReportsSharedHelpers } from "./query-support/shared";
import type {
  AccountingReportsContext,
  AccountingReportsDocumentsPort,
} from "../../application/reports/ports";
import type { AccountingReportsRepository } from "../drizzle/repos/reports-repository";

export function createAccountingReportsContext(input: {
  balancesQueries: BalancesQueries;
  counterpartiesQueries: CounterpartiesQueries;
  documentsPort: AccountingReportsDocumentsPort;
  ledgerQueries: LedgerQueries;
  organizationsQueries: OrganizationsQueries;
  reportsRepository: AccountingReportsRepository;
}): AccountingReportsContext {
  const {
    balancesQueries,
    counterpartiesQueries,
    documentsPort,
    ledgerQueries,
    organizationsQueries,
    reportsRepository,
  } = input;

  return {
    ...createReportsSharedHelpers({
      balancesQueries,
      counterpartiesQueries,
      ledgerQueries,
      organizationsQueries,
      reportsRepository,
    }),
    ...createReportsScopeHelpers({
      counterpartiesQueries,
      documentsPort,
      ledgerQueries,
      organizationsQueries,
    }),
    assertInternalOrganization:
      organizationsQueries.assertInternalLedgerOrganization,
  };
}
