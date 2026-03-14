import { createBalancesQueries } from "@bedrock/balances/queries";
import { createCounterpartiesQueries } from "@bedrock/counterparties/queries";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  createAccountingReportQueries,
  type AccountingReportQueries,
} from "./application/reports/queries/reports";
import type { AccountingReportsContext } from "./application/reports/ports";
import { createDrizzleAccountingReportsRepository } from "./infra/drizzle/repos/reports-repository";
import { createAccountingReportsContext } from "./infra/reporting/context";

type Queryable = Database | Transaction;

export function createAccountingReportingRuntime(input: { db: Queryable }): {
  counterpartiesQueries: ReturnType<typeof createCounterpartiesQueries>;
  ledgerQueries: ReturnType<typeof createLedgerQueries>;
  organizationsQueries: ReturnType<typeof createOrganizationsQueries>;
  reportContext: AccountingReportsContext;
  reportQueries: AccountingReportQueries;
} {
  const balancesQueries = createBalancesQueries({ db: input.db });
  const counterpartiesQueries = createCounterpartiesQueries({ db: input.db });
  const ledgerQueries = createLedgerQueries({ db: input.db });
  const organizationsQueries = createOrganizationsQueries({ db: input.db });
  const reportsRepository = createDrizzleAccountingReportsRepository(input.db);
  const reportContext = createAccountingReportsContext({
    balancesQueries,
    counterpartiesQueries,
    ledgerQueries,
    organizationsQueries,
    reportsRepository,
  });

  return {
    counterpartiesQueries,
    ledgerQueries,
    organizationsQueries,
    reportContext,
    reportQueries: createAccountingReportQueries({
      context: reportContext,
    }),
  };
}
