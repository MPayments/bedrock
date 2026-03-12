import { inArray } from "drizzle-orm";

import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { createBedrockDimensionRegistry } from "@bedrock/accounting-reporting/dimensions";
import { type Dimensions } from "@bedrock/ledger/schema";

import {
  createAccountingReportingServiceContext,
  type AccountingReportingServiceDeps,
} from "./internal/context";
import { createAccountingReportsService } from "./reports-service";

const schema = {
  ...accountingSchema,
};

export type AccountingReportingService = ReturnType<
  typeof createAccountingReportingService
>;

type RawLedgerOperationDetails = NonNullable<
  Awaited<
    ReturnType<
      AccountingReportingServiceDeps["ledgerReadService"]["getOperationDetails"]
    >
  >
>;

type LedgerOperationDetailsWithLabels = RawLedgerOperationDetails & {
  dimensionLabels: Record<string, string>;
};

type RawLedgerOperationList = Awaited<
  ReturnType<
    AccountingReportingServiceDeps["ledgerReadService"]["listOperations"]
  >
>;

type LedgerOperationListWithLabels = Omit<RawLedgerOperationList, "data"> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

export function createAccountingReportingService(
  deps: AccountingReportingServiceDeps,
) {
  const context = createAccountingReportingServiceContext(deps);
  const { db, ledgerReadService } = context;
  const dimensionRegistry = createBedrockDimensionRegistry();
  const reportsService = createAccountingReportsService({ db });

  async function getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null> {
    const details = await ledgerReadService.getOperationDetails(operationId);
    if (!details) {
      return null;
    }

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
      dimensionLabels: Object.fromEntries(
        Object.values(resolved).flatMap((labelsById) =>
          Object.entries(labelsById as Record<string, string>),
        ),
      ),
    };
  }

  async function listOperationsWithLabels(
    input?: Parameters<
      AccountingReportingServiceDeps["ledgerReadService"]["listOperations"]
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
    ...reportsService,
  };
}
