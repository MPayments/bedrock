import type { BalancesQueries } from "@bedrock/balances/queries";
import type { LedgerQueries } from "@bedrock/ledger/queries";
import { parseMinorAmountOrZero } from "@bedrock/shared/money";

import type {
  AccountingCounterpartiesQueryPort,
  AccountingOrganizationsQueryPort,
} from "../party-query-ports";
import {
  type LineMapping,
  type ReportAttributionMode,
  type ResolvedScope,
  type ScopedPosting,
} from "../../../domain/reports";
import type { AccountingReportsRepository } from "../../drizzle/repos/reports-repository";

export function keyByParts(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => part ?? "").join("::");
}

export function createReportsSharedHelpers(input: {
  balancesQueries: BalancesQueries;
  counterpartiesQueries: AccountingCounterpartiesQueryPort;
  ledgerQueries: LedgerQueries;
  organizationsQueries: AccountingOrganizationsQueryPort;
  reportsRepository: AccountingReportsRepository;
}) {
  const {
    balancesQueries,
    counterpartiesQueries,
    ledgerQueries,
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
    const [books, organizationNames] = await Promise.all([
      ledgerQueries.listBooksById(rows.map((row) => row.bookId)),
      organizationsQueries.listShortNamesById(
        rows
          .map((row) => row.counterpartyId)
          .filter((value): value is string => Boolean(value)),
      ),
    ]);
    const bookNames = new Map(
      books.map((book) => [book.id, book.name ?? book.id]),
    );

    return rows.map((row) => ({
      bookId: row.bookId,
      bookLabel: bookNames.get(row.bookId) ?? row.bookId,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyId
        ? (organizationNames.get(row.counterpartyId) ?? null)
        : null,
      currency: row.currency,
      ledgerBalanceMinor: parseMinorAmountOrZero(row.ledgerBalanceMinor),
      availableMinor: parseMinorAmountOrZero(row.availableMinor),
      reservedMinor: parseMinorAmountOrZero(row.reservedMinor),
      pendingMinor: parseMinorAmountOrZero(row.pendingMinor),
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
