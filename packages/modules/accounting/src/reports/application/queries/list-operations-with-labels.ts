import type {
  LedgerOperationList,
  ListLedgerOperationsInput,
} from "@bedrock/ledger/contracts";

import {
  ListOperationsWithLabelsQuerySchema,
  type ListOperationsWithLabelsQuery as ListOperationsWithLabelsInput,
} from "../contracts/operation.queries";
import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../ports";
import type { ReportsReads } from "../ports/reports.reads";

type RawLedgerOperationList = LedgerOperationList;

export type LedgerOperationListWithLabels = Omit<
  RawLedgerOperationList,
  "data"
> & {
  data: (RawLedgerOperationList["data"][number] & {
    bookLabels: Record<string, string>;
  })[];
};

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export class ListOperationsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: ListOperationsWithLabelsInput) {
    return this.reads.listOperationsWithLabels(
      omitUndefined(ListOperationsWithLabelsQuerySchema.parse(query ?? {})),
    );
  }
}

export class ListOperationsWithLabelsReadQuery {
  constructor(
    private readonly input: {
      ledgerReadPort: Pick<AccountingReportsLedgerPort, "listOperations">;
      listBookNamesById: AccountingReportsServicePorts["listBookNamesById"];
    },
  ) {}

  async execute(
    query?: ListLedgerOperationsInput,
  ): Promise<LedgerOperationListWithLabels> {
    const { ledgerReadPort, listBookNamesById } = this.input;
    const result = await ledgerReadPort.listOperations(
      query ? omitUndefined(query) : undefined,
    );
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
}
