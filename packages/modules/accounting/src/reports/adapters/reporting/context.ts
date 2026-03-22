import type {
  AccountingBalancesQueryPort,
  AccountingLedgerQueryPort,
} from "./ledger-query-ports";
import type {
  AccountingCounterpartiesQueryPort,
  AccountingOrganizationsQueryPort,
} from "./party-query-ports";
import { createReportsScopeHelpers } from "./query-support/scope";
import { createReportsSharedHelpers } from "./query-support/shared";
import type {
  AccountingReportsContext,
  AccountingReportsDocumentsPort,
} from "../../application/ports";
import type { DrizzleReportsRepository } from "../drizzle/reports.repository";

export function createAccountingReportsContext(input: {
  balancesQueries: AccountingBalancesQueryPort;
  counterpartiesQueries: AccountingCounterpartiesQueryPort;
  documentsPort: AccountingReportsDocumentsPort;
  ledgerQueries: AccountingLedgerQueryPort;
  organizationsQueries: AccountingOrganizationsQueryPort;
  reportsRepository: DrizzleReportsRepository;
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
