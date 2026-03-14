import { inArray } from "drizzle-orm";

import { getDefaultPrecision } from "@bedrock/currencies";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as ledgerSchema, type Dimensions } from "@bedrock/ledger/schema";

import {
  createAccountingReportsServiceContext,
  type AccountingReportsServiceDeps,
} from "./context";
import { createAccountingReportQueriesService } from "./report-service";
import { createBedrockDimensionRegistry } from "../../infra/reporting/dimensions";

const schema = {
  ...ledgerSchema,
};

export type AccountingReportsService = ReturnType<
  typeof createAccountingReportsService
>;

type RawLedgerOperationDetails = NonNullable<
  Awaited<
    ReturnType<
      AccountingReportsServiceDeps["ledgerReadService"]["getOperationDetails"]
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
    AccountingReportsServiceDeps["ledgerReadService"]["listOperations"]
  >
>;

type LedgerOperationListWithLabels = Omit<RawLedgerOperationList, "data"> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

export function createAccountingReportsService(
  deps: AccountingReportsServiceDeps,
) {
  const context = createAccountingReportsServiceContext(deps);
  const { db, ledgerReadService } = context;
  const dimensionRegistry = createBedrockDimensionRegistry();
  const reportQueries = createAccountingReportQueriesService({ db });

  async function getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null> {
    const details = await ledgerReadService.getOperationDetails(operationId);
    if (!details) {
      return null;
    }

    const currencyCodes = Array.from(
      new Set(details.postings.map((posting) => posting.currency)),
    );
    const currencyRows =
      currencyCodes.length === 0
        ? []
        : await db
            .select({
              code: currenciesSchema.currencies.code,
              precision: currenciesSchema.currencies.precision,
            })
            .from(currenciesSchema.currencies)
            .where(inArray(currenciesSchema.currencies.code, currencyCodes));
    const precisionByCode = new Map(
      currencyRows.map((row) => [row.code, row.precision]),
    );

    const resolved = await dimensionRegistry.resolveLabelsFromDimensionRecords({
      db,
      records: details.postings.flatMap(
        (posting: RawLedgerOperationDetails["postings"][number]) => [
          (posting.debitDimensions as Dimensions | null) ?? null,
          (posting.creditDimensions as Dimensions | null) ?? null,
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
      AccountingReportsServiceDeps["ledgerReadService"]["listOperations"]
    >[0],
  ): Promise<LedgerOperationListWithLabels> {
    const result = await ledgerReadService.listOperations(input);
    const bookIds = Array.from(
      new Set(result.data.flatMap((row) => row.bookIds)),
    );
    const bookRows =
      bookIds.length === 0
        ? []
        : await db
            .select({
              id: schema.books.id,
              name: schema.books.name,
            })
            .from(schema.books)
            .where(inArray(schema.books.id, bookIds));
    const bookNamesById = new Map(bookRows.map((row) => [row.id, row.name]));

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
