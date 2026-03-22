import {
  paginateInMemory,
  resolveSortOrder,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  AccountingReportsContext,
  GeneralLedgerBalance,
  GeneralLedgerEntry,
} from "./types";
import {
  GeneralLedgerQuerySchema,
  type GeneralLedgerQuery,
} from "../reports-validation";
import { fetchScopedReportPostings, sortRowsByContextParts } from "./shared";

export function createListGeneralLedgerHandler(
  context: AccountingReportsContext,
) {
  return async function listGeneralLedger(input?: GeneralLedgerQuery): Promise<
    PaginatedList<GeneralLedgerEntry> & {
      openingBalances: GeneralLedgerBalance[];
      closingBalances: GeneralLedgerBalance[];
      scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
    }
  > {
    const query = GeneralLedgerQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);
    const { postings, scopeMeta } = await fetchScopedReportPostings(context, {
      query,
      to,
    });

    const accountSet = new Set(query.accountNo);
    const openingByKey = new Map<string, GeneralLedgerBalance>();

    const entrySeed: (GeneralLedgerEntry & {
      deltaMinor: bigint;
      sideOrder: number;
    })[] = [];

    for (const posting of postings) {
      const attributionId =
        query.attributionMode === "analytic_counterparty"
          ? posting.analyticCounterpartyId
          : posting.bookCounterpartyId;

      if (accountSet.has(posting.debitAccountNo)) {
        const deltaMinor = posting.amountMinor;
        if (posting.postingDate < from) {
          const key = context.keyByParts(
            posting.debitAccountNo,
            posting.currency,
          );
          const opening = openingByKey.get(key) ?? {
            accountNo: posting.debitAccountNo,
            currency: posting.currency,
            balanceMinor: 0n,
          };
          opening.balanceMinor += deltaMinor;
          openingByKey.set(key, opening);
        } else {
          entrySeed.push({
            operationId: posting.operationId,
            lineNo: posting.lineNo,
            postingDate: posting.postingDate,
            bookId: posting.bookId,
            bookLabel: posting.bookLabel ?? posting.bookId,
            accountNo: posting.debitAccountNo,
            currency: posting.currency,
            postingCode: posting.postingCode,
            counterpartyId: attributionId,
            debitMinor: posting.amountMinor,
            creditMinor: 0n,
            runningBalanceMinor: 0n,
            deltaMinor,
            sideOrder: 0,
          });
        }
      }

      if (accountSet.has(posting.creditAccountNo)) {
        const deltaMinor = -posting.amountMinor;
        if (posting.postingDate < from) {
          const key = context.keyByParts(
            posting.creditAccountNo,
            posting.currency,
          );
          const opening = openingByKey.get(key) ?? {
            accountNo: posting.creditAccountNo,
            currency: posting.currency,
            balanceMinor: 0n,
          };
          opening.balanceMinor += deltaMinor;
          openingByKey.set(key, opening);
        } else {
          entrySeed.push({
            operationId: posting.operationId,
            lineNo: posting.lineNo,
            postingDate: posting.postingDate,
            bookId: posting.bookId,
            bookLabel: posting.bookLabel ?? posting.bookId,
            accountNo: posting.creditAccountNo,
            currency: posting.currency,
            postingCode: posting.postingCode,
            counterpartyId: attributionId,
            debitMinor: 0n,
            creditMinor: posting.amountMinor,
            runningBalanceMinor: 0n,
            deltaMinor,
            sideOrder: 1,
          });
        }
      }
    }

    const inPeriodEntries = entrySeed.filter(
      (entry) => entry.postingDate >= from && entry.postingDate <= to,
    );

    const sortMap = {
      postingDate: (row: (typeof inPeriodEntries)[number]) => row.postingDate,
      operationId: (row: (typeof inPeriodEntries)[number]) => row.operationId,
      lineNo: (row: (typeof inPeriodEntries)[number]) => row.lineNo,
    };

    const sortedSeed = sortInMemory(inPeriodEntries, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    }).sort((left, right) => {
      if (left.operationId !== right.operationId) {
        return left.operationId.localeCompare(right.operationId);
      }

      if (left.lineNo !== right.lineNo) {
        return left.lineNo - right.lineNo;
      }

      return left.sideOrder - right.sideOrder;
    });

    const runningByKey = new Map<string, bigint>(
      Array.from(openingByKey.values()).map((row) => [
        context.keyByParts(row.accountNo, row.currency),
        row.balanceMinor,
      ]),
    );

    const entries: GeneralLedgerEntry[] = sortedSeed.map((entry) => {
      const key = context.keyByParts(entry.accountNo, entry.currency);
      const running = (runningByKey.get(key) ?? 0n) + entry.deltaMinor;
      runningByKey.set(key, running);

      return {
        operationId: entry.operationId,
        lineNo: entry.lineNo,
        postingDate: entry.postingDate,
        bookId: entry.bookId,
        bookLabel: entry.bookLabel,
        accountNo: entry.accountNo,
        currency: entry.currency,
        postingCode: entry.postingCode,
        counterpartyId: entry.counterpartyId,
        debitMinor: entry.debitMinor,
        creditMinor: entry.creditMinor,
        runningBalanceMinor: running,
      };
    });

    const paginated = paginateInMemory(entries, {
      limit: query.limit,
      offset: query.offset,
    });

    const openingBalances = sortRowsByContextParts(
      context,
      openingByKey.values(),
      (row) => [row.accountNo, row.currency],
    );

    const closingBalances = sortRowsByContextParts(
      context,
      Array.from(runningByKey.entries()).map(([key, balanceMinor]) => {
        const [accountNo = "", currency = ""] = key.split("::");
        return {
          accountNo,
          currency,
          balanceMinor,
        };
      }),
      (row) => [row.accountNo, row.currency],
    );

    return {
      ...paginated,
      openingBalances,
      closingBalances,
      scopeMeta,
    };
  };
}
