import type { LedgerReadService } from "@bedrock/ledger";

import type { AccountingReportsServicePorts } from "../ports";

type RawLedgerOperationList = Awaited<
  ReturnType<
    Pick<
      LedgerReadService,
      "listOperations"
    >["listOperations"]
  >
>;

export type LedgerOperationListWithLabels = Omit<RawLedgerOperationList, "data"> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

export function createListOperationsWithLabelsQuery(input: {
  ledgerReadService: Pick<LedgerReadService, "listOperations">;
  listBookNamesById: AccountingReportsServicePorts["listBookNamesById"];
}) {
  const { ledgerReadService, listBookNamesById } = input;

  return async function listOperationsWithLabels(
    query?: Parameters<
      Pick<LedgerReadService, "listOperations">["listOperations"]
    >[0],
  ): Promise<LedgerOperationListWithLabels> {
    const result = await ledgerReadService.listOperations(query);
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
  };
}
