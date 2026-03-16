import { getDefaultPrecision } from "@bedrock/currencies/contracts";

import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../ports";

type RawLedgerOperationDetails = NonNullable<
  Awaited<
    ReturnType<AccountingReportsLedgerPort["getOperationDetails"]>
  >
>;

export type LedgerOperationDetailsWithLabels = Omit<
  RawLedgerOperationDetails,
  "postings"
> & {
  postings: (RawLedgerOperationDetails["postings"][number] & {
    currencyPrecision: number;
  })[];
  dimensionLabels: Record<string, string>;
};

function toDimensionLabels(
  resolved: Record<string, Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.values(resolved).flatMap((labelsById) =>
      Object.entries(labelsById as Record<string, string>),
    ),
  );
}

export function createListOperationDetailsWithLabelsQuery(input: {
  ledgerReadPort: Pick<AccountingReportsLedgerPort, "listOperationDetails">;
  listCurrencyPrecisionsByCode: AccountingReportsServicePorts["listCurrencyPrecisionsByCode"];
  resolveDimensionLabelsFromRecords: AccountingReportsServicePorts["resolveDimensionLabelsFromRecords"];
}) {
  const {
    ledgerReadPort,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
  } = input;

  return async function listOperationDetailsWithLabels(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetailsWithLabels>> {
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
    const dimensionLabels = toDimensionLabels(resolved);

    return new Map(
      detailsList.map((details) => [
        details.operation.id,
        {
          ...details,
          postings: details.postings.map((posting) => ({
            ...posting,
            currencyPrecision:
              precisionByCode.get(posting.currency) ??
              getDefaultPrecision(posting.currency),
          })),
          dimensionLabels,
        },
      ]),
    );
  };
}
