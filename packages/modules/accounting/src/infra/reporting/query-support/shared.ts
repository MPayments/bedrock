import type { BalancesQueries } from "@bedrock/balances/queries";
import type { CounterpartiesQueries } from "@bedrock/counterparties/queries";
import type { OrganizationsQueries } from "@bedrock/organizations/queries";

import { toBigInt } from "../../../domain/reports/normalization";
import type { LineMapping, ScopedPosting } from "../../../domain/reports/types";
import type { ResolvedScope, ReportAttributionMode } from "../../../domain/reports/types";
import type { AccountingReportsRepository } from "../../drizzle/repos/reports-repository";

export function keyByParts(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => part ?? "").join("::");
}

export function createReportsSharedHelpers(input: {
  balancesQueries: BalancesQueries;
  counterpartiesQueries: CounterpartiesQueries;
  organizationsQueries: OrganizationsQueries;
  reportsRepository: AccountingReportsRepository;
}) {
  const {
    balancesQueries,
    counterpartiesQueries,
    organizationsQueries,
    reportsRepository,
  } = input;

  async function fetchCounterpartyNames(ids: string[]): Promise<Map<string, string>> {
    return counterpartiesQueries.listShortNamesById(ids);
  }

  async function fetchAccountMeta(
    accountNos: string[],
  ): Promise<Map<string, { name: string; kind: string }>> {
    return reportsRepository.fetchAccountMeta(accountNos);
  }

  async function fetchLineMappings(
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ): Promise<Map<string, LineMapping[]>> {
    return reportsRepository.fetchLineMappings(reportKind, asOf);
  }

  function computeAccountNetMovements(
    postings: ScopedPosting[],
  ): Map<string, { accountNo: string; currency: string; netMinor: bigint }> {
    const movements = new Map<
      string,
      { accountNo: string; currency: string; netMinor: bigint }
    >();

    for (const posting of postings) {
      const debitKey = keyByParts(posting.debitAccountNo, posting.currency);
      const debit = movements.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      debit.netMinor += posting.amountMinor;
      movements.set(debitKey, debit);

      const creditKey = keyByParts(posting.creditAccountNo, posting.currency);
      const credit = movements.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      credit.netMinor -= posting.amountMinor;
      movements.set(creditKey, credit);
    }

    return movements;
  }

  async function fetchLiquidityRows(inputArgs: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    currency?: string;
  }) {
    const internalLedgerOrganizationIds =
      await organizationsQueries.listInternalLedgerOrganizationIds();
    const rows = await balancesQueries.listOrganizationLiquidityRows({
      resolvedBookIds: inputArgs.scope.resolvedBookIds,
      resolvedCounterpartyIds: inputArgs.scope.resolvedCounterpartyIds,
      scopeType: inputArgs.scope.scopeType,
      attributionMode: inputArgs.attributionMode,
      internalLedgerOrganizationIds,
      currency: inputArgs.currency,
    });

    return rows.map((row) => ({
      bookId: row.bookId,
      bookLabel: row.bookLabel ?? row.bookId,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      ledgerBalanceMinor: toBigInt(row.ledgerBalanceMinor),
      availableMinor: toBigInt(row.availableMinor),
      reservedMinor: toBigInt(row.reservedMinor),
      pendingMinor: toBigInt(row.pendingMinor),
    }));
  }

  async function findLatestClosePackage(inputArgs: {
    organizationId: string;
    periodStart: Date;
  }) {
    return reportsRepository.findLatestClosePackage(inputArgs);
  }

  return {
    fetchAccountMeta,
    fetchCounterpartyNames,
    fetchLineMappings,
    fetchLiquidityRows,
    findLatestClosePackage,
    keyByParts,
    computeAccountNetMovements,
  };
}
