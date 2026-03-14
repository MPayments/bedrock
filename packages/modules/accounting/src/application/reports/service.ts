import { getDefaultPrecision } from "@bedrock/currencies";
import type { LedgerReadService } from "@bedrock/ledger";

import type { createAccountingReportQueriesService } from "./report-service";

export type AccountingReportsService = ReturnType<
  typeof createAccountingReportsService
>;

type RawLedgerOperationDetails = NonNullable<
  Awaited<
    ReturnType<
      Pick<
        LedgerReadService,
        "getOperationDetails"
      >["getOperationDetails"]
    >
  >
>;

type LedgerOperationDetailsWithLabels = Omit<RawLedgerOperationDetails, "postings"> & {
  postings: (RawLedgerOperationDetails["postings"][number] & {
    currencyPrecision: number;
  })[];
  dimensionLabels: Record<string, string>;
};

type RawLedgerOperationList = Awaited<
  ReturnType<
    Pick<
      LedgerReadService,
      "listOperations"
    >["listOperations"]
  >
>;

type LedgerOperationListWithLabels = Omit<RawLedgerOperationList, "data"> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

export function createAccountingReportsService(
  deps: {
    ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
    listBookNamesById: (ids: string[]) => Promise<Map<string, string>>;
    listCurrencyPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
    resolveDimensionLabelsFromRecords: (input: {
      records: (Record<string, string> | null | undefined)[];
    }) => Promise<Record<string, Record<string, string>>>;
    reportQueries: ReturnType<typeof createAccountingReportQueriesService>;
  },
) {
  const {
    ledgerReadService,
    listBookNamesById,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
    reportQueries,
  } = deps;

  async function getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null> {
    const details = await ledgerReadService.getOperationDetails(operationId);
    if (!details) {
      return null;
    }

    const precisionByCode = await listCurrencyPrecisionsByCode(
      Array.from(new Set(details.postings.map((posting) => posting.currency))),
    );

    const resolved = await resolveDimensionLabelsFromRecords({
      records: details.postings.flatMap(
        (posting: RawLedgerOperationDetails["postings"][number]) => [
          (posting.debitDimensions as Record<string, string> | null) ?? null,
          (posting.creditDimensions as Record<string, string> | null) ?? null,
        ],
      ),
    });

    return {
      ...details,
      postings: details.postings.map((posting) => ({
        ...posting,
        currencyPrecision:
          precisionByCode.get(posting.currency) ??
          getDefaultPrecision(posting.currency),
      })),
      dimensionLabels: Object.fromEntries(
        Object.values(resolved).flatMap((labelsById) =>
          Object.entries(labelsById as Record<string, string>),
        ),
      ),
    };
  }

  async function listOperationsWithLabels(
    input?: Parameters<
      Pick<LedgerReadService, "listOperations">["listOperations"]
    >[0],
  ): Promise<LedgerOperationListWithLabels> {
    const result = await ledgerReadService.listOperations(input);
    const bookNamesById = await listBookNamesById(
      Array.from(new Set(result.data.flatMap((row) => row.bookIds))),
    );

    return {
      ...result,
      data: result.data.map((row) => ({
        ...row,
        bookLabels: Object.fromEntries(
          row.bookIds.map((bookId) => [
            bookId,
            bookNamesById.get(bookId) ?? bookId,
          ]),
        ),
      })),
    };
  }

  return {
    getOperationDetailsWithLabels,
    listOperationsWithLabels,
    ...reportQueries,
  };
}
