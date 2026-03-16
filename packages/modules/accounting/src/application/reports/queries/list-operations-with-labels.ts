import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../ports";

type RawLedgerOperationList = Awaited<
  ReturnType<AccountingReportsLedgerPort["listOperations"]>
>;

export type LedgerOperationListWithLabels = Omit<RawLedgerOperationList, "data"> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

export function createListOperationsWithLabelsQuery(input: {
  ledgerReadPort: Pick<AccountingReportsLedgerPort, "listOperations">;
  listBookNamesById: AccountingReportsServicePorts["listBookNamesById"];
}) {
  const { ledgerReadPort, listBookNamesById } = input;

  return async function listOperationsWithLabels(
    query?: Parameters<AccountingReportsLedgerPort["listOperations"]>[0],
  ): Promise<LedgerOperationListWithLabels> {
    const result = await ledgerReadPort.listOperations(query);
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
