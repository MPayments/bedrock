import { getDefaultPrecision } from "@bedrock/currencies/contracts";
import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";

import {
  ListOperationDetailsWithLabelsInputSchema,
  type ListOperationDetailsWithLabelsInput,
} from "../contracts/operation.queries";
import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../ports";
import type { ReportsReads } from "../ports/reports.reads";

type RawLedgerOperationDetails = LedgerOperationDetails;

export type LedgerOperationDetailsWithLabels = Omit<
  RawLedgerOperationDetails,
  "postings"
> & {
  postings: (RawLedgerOperationDetails["postings"][number] & {
    currencyPrecision: number;
  })[];
  dimensionLabels: Record<string, string>;
};

export class ListOperationDetailsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(operationIds: ListOperationDetailsWithLabelsInput) {
    return this.reads.listOperationDetailsWithLabels(
      ListOperationDetailsWithLabelsInputSchema.parse(operationIds),
    );
  }
}

export class ListOperationDetailsWithLabelsReadQuery {
  constructor(
    private readonly input: {
      ledgerReadPort: Pick<AccountingReportsLedgerPort, "listOperationDetails">;
      listBookNamesById: AccountingReportsServicePorts["listBookNamesById"];
      listCurrencyPrecisionsByCode: AccountingReportsServicePorts["listCurrencyPrecisionsByCode"];
      resolveDimensionLabelsFromRecords: AccountingReportsServicePorts["resolveDimensionLabelsFromRecords"];
    },
  ) {}

  async execute(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetailsWithLabels>> {
    const {
      ledgerReadPort,
      listBookNamesById,
      listCurrencyPrecisionsByCode,
      resolveDimensionLabelsFromRecords,
    } = this.input;
    const detailsById = await ledgerReadPort.listOperationDetails(operationIds);
    const detailsList = Array.from(detailsById.values());
    if (detailsList.length === 0) {
      return new Map();
    }

    const precisionByCode = await listCurrencyPrecisionsByCode(
      Array.from(
        new Set(
          detailsList.flatMap((details) =>
            details.postings.map((posting) => posting.currency),
          ),
        ),
      ),
    );
    const resolved = await resolveDimensionLabelsFromRecords({
      records: detailsList.flatMap((details) =>
        details.postings.flatMap((posting) => [
          (posting.debitDimensions as Record<string, string> | null) ?? null,
          (posting.creditDimensions as Record<string, string> | null) ?? null,
        ]),
      ),
    });
    const bookNamesById = await listBookNamesById(
      Array.from(
        new Set(
          detailsList.flatMap((details) =>
            details.postings.map((posting) => posting.bookId),
          ),
        ),
      ),
    );
    const dimensionLabels = toDimensionLabels(resolved);

    return new Map(
      detailsList.map((details) => [
        details.operation.id,
        {
          ...details,
          postings: details.postings.map((posting) => ({
            ...posting,
            bookName: bookNamesById.get(posting.bookId) ?? posting.bookName,
            currencyPrecision:
              precisionByCode.get(posting.currency) ??
              getDefaultPrecision(posting.currency),
          })),
          dimensionLabels,
        },
      ]),
    );
  }
}

function toDimensionLabels(
  resolved: Record<string, Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.values(resolved).flatMap((labelsById) =>
      Object.entries(labelsById as Record<string, string>),
    ),
  );
}
