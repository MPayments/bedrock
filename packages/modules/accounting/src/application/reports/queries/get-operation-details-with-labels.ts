import { getDefaultPrecision } from "@bedrock/currencies";
import type { LedgerReadService } from "@bedrock/ledger";

import type { AccountingReportsServicePorts } from "../ports";

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

export type LedgerOperationDetailsWithLabels = Omit<
  RawLedgerOperationDetails,
  "postings"
> & {
  postings: (RawLedgerOperationDetails["postings"][number] & {
    currencyPrecision: number;
  })[];
  dimensionLabels: Record<string, string>;
};

export function createGetOperationDetailsWithLabelsQuery(input: {
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails">;
  listCurrencyPrecisionsByCode: AccountingReportsServicePorts["listCurrencyPrecisionsByCode"];
  resolveDimensionLabelsFromRecords: AccountingReportsServicePorts["resolveDimensionLabelsFromRecords"];
}) {
  const {
    ledgerReadService,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
  } = input;

  return async function getOperationDetailsWithLabels(
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
      records: details.postings.flatMap((posting) => [
        (posting.debitDimensions as Record<string, string> | null) ?? null,
        (posting.creditDimensions as Record<string, string> | null) ?? null,
      ]),
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
  };
}
