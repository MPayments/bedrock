import type { CurrenciesService } from "@bedrock/currencies";
import { normalizeFinancialLine } from "@bedrock/documents/contracts";
import type { FxService } from "@bedrock/fx";
import type { LedgerReadService } from "@bedrock/ledger";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ServiceError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";

import type { IfrsModuleDeps } from "../documents/internal/types";
import { FxExecuteQuoteSnapshotSchema } from "../validation";

const FX_EXECUTE_DOC_TYPE = "fx_execute";
const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

type IfrsFxQuotesPort = Pick<
  FxService["quotes"],
  "getQuoteDetails" | "markQuoteUsed" | "quote"
>;

type IfrsLedgerReadPort = Pick<LedgerReadService, "getOperationDetails">;

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

function rethrowAsDocumentValidationError(error: unknown): never {
  if (error instanceof DocumentValidationError) {
    throw error;
  }

  if (error instanceof ServiceError) {
    throw new DocumentValidationError(error.message);
  }

  throw error;
}

async function buildCurrencyPrecisionMap(
  currenciesService: Pick<CurrenciesService, "findByCode">,
  currencyCodes: string[],
) {
  const uniqueCurrencyCodes = [...new Set(currencyCodes)];
  const precisionByCode = new Map<string, number>();

  await Promise.all(
    uniqueCurrencyCodes.map(async (code) => {
      const currency = await currenciesService.findByCode(code);
      precisionByCode.set(code, currency.precision);
    }),
  );

  return precisionByCode;
}

async function buildQuoteSnapshotBase(input: {
  currenciesService: CurrenciesService;
  details: Awaited<ReturnType<IfrsFxQuotesPort["getQuoteDetails"]>>;
}) {
  const { currenciesService, details } = input;
  const fromCurrency = details.quote.fromCurrency;
  const toCurrency = details.quote.toCurrency;

  if (!fromCurrency || !toCurrency) {
    throw new DocumentValidationError(
      `Quote ${details.quote.id} is missing currency codes`,
    );
  }

  const precisionByCode = await buildCurrencyPrecisionMap(
    { findByCode: currenciesService.findByCode },
    [
      fromCurrency,
      toCurrency,
      ...details.legs.flatMap((leg) => [
        leg.fromCurrency ?? fromCurrency,
        leg.toCurrency ?? toCurrency,
      ]),
      ...details.financialLines.map((line) => line.currency),
    ],
  );

  return {
    quoteId: details.quote.id,
    idempotencyKey: details.quote.idempotencyKey,
    fromCurrency,
    toCurrency,
    fromAmountMinor: details.quote.fromAmountMinor.toString(),
    toAmountMinor: details.quote.toAmountMinor.toString(),
    pricingMode: details.quote.pricingMode,
    rateNum: details.quote.rateNum.toString(),
    rateDen: details.quote.rateDen.toString(),
    expiresAt: details.quote.expiresAt.toISOString(),
    pricingTrace: (details.quote.pricingTrace ?? {}) as Record<string, unknown>,
    legs: details.legs.map((leg) => ({
      idx: leg.idx,
      fromCurrency: leg.fromCurrency ?? fromCurrency,
      toCurrency: leg.toCurrency ?? toCurrency,
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    })),
    financialLines: details.financialLines.map((line) => {
      const normalizedLine = normalizeFinancialLine(line);
      const precision = precisionByCode.get(normalizedLine.currency);

      if (precision === undefined) {
        throw new DocumentValidationError(
          `Missing currency precision for ${normalizedLine.currency}`,
        );
      }

      return {
        ...normalizedLine,
        amount: minorToAmountString(normalizedLine.amountMinor, {
          precision,
        }),
        amountMinor: normalizedLine.amountMinor.toString(),
        settlementMode: normalizedLine.settlementMode ?? "in_ledger",
      };
    }),
  };
}

async function loadFxExecuteQuoteSnapshotById(input: {
  currenciesService: CurrenciesService;
  fxQuotes: IfrsFxQuotesPort;
  quoteId: string;
}) {
  try {
    const details = await input.fxQuotes.getQuoteDetails({
      quoteRef: input.quoteId,
    });
    const snapshotWithoutHash = await buildQuoteSnapshotBase({
      currenciesService: input.currenciesService,
      details,
    });

    return FxExecuteQuoteSnapshotSchema.parse({
      ...snapshotWithoutHash,
      snapshotHash: buildQuoteSnapshotHash(snapshotWithoutHash),
    });
  } catch (error) {
    rethrowAsDocumentValidationError(error);
  }
}

async function markQuoteUsedForRef(input: {
  fxQuotes: IfrsFxQuotesPort;
  quoteId: string;
  usedByRef: string;
  at: Date;
}) {
  try {
    await input.fxQuotes.markQuoteUsed({
      quoteId: input.quoteId,
      usedByRef: input.usedByRef,
      at: input.at,
    });
  } catch (error) {
    rethrowAsDocumentValidationError(error);
  }
}

async function listPendingTransfersForOperation(input: {
  ledgerReadService: IfrsLedgerReadPort;
  operationId: string;
}) {
  const details = await input.ledgerReadService.getOperationDetails(
    input.operationId,
  );

  if (!details) {
    return [];
  }

  return details.tbPlans
    .filter((plan) => plan.isPending)
    .sort((left, right) => left.lineNo - right.lineNo)
    .map((plan) => ({
      transferId: plan.transferId,
      pendingRef: plan.pendingRef,
      amountMinor: plan.amount,
    }));
}

export function createIfrsDocumentDeps(input: {
  currenciesService: CurrenciesService;
  fxQuotes: IfrsFxQuotesPort;
  ledgerReadService: IfrsLedgerReadPort;
  requisitesService: IfrsModuleDeps["requisitesService"];
}): IfrsModuleDeps {
  const { currenciesService, fxQuotes, ledgerReadService, requisitesService } =
    input;

  return {
    requisitesService,
    transferLookup: {
      async resolveTransferDependencyDocument({ runtime, transferDocumentId }) {
        let dependency = null;

        for (const docType of TRANSFER_DOC_TYPES) {
          dependency = await runtime.documents.getDocumentByType({
            documentId: transferDocumentId,
            docType,
          });
          if (dependency) {
            break;
          }
        }

        if (!dependency) {
          throw new DocumentValidationError(
            `Transfer document ${transferDocumentId} was not found`,
          );
        }

        return dependency;
      },
      async listPendingTransfers({ runtime, transferDocumentId }) {
        const operationId = await runtime.documents.getDocumentOperationId({
          documentId: transferDocumentId,
          kind: "post",
        });
        if (!operationId) {
          return [];
        }

        return listPendingTransfersForOperation({
          ledgerReadService,
          operationId,
        });
      },
    },
    fxExecuteLookup: {
      async resolveFxExecuteDependencyDocument({
        runtime,
        fxExecuteDocumentId,
      }) {
        const dependency = await runtime.documents.getDocumentByType({
          documentId: fxExecuteDocumentId,
          docType: FX_EXECUTE_DOC_TYPE,
        });

        if (!dependency) {
          throw new DocumentValidationError(
            `FX execute document ${fxExecuteDocumentId} was not found`,
          );
        }

        return dependency;
      },
      async listPendingTransfers({ runtime, fxExecuteDocumentId }) {
        const operationId = await runtime.documents.getDocumentOperationId({
          documentId: fxExecuteDocumentId,
          kind: "post",
        });
        if (!operationId) {
          return [];
        }

        return listPendingTransfersForOperation({
          ledgerReadService,
          operationId,
        });
      },
    },
    treasuryFxQuote: {
      async createQuoteSnapshot({
        fromCurrency,
        toCurrency,
        fromAmountMinor,
        asOf,
        idempotencyKey,
      }) {
        try {
          const quote = await fxQuotes.quote({
            mode: "auto_cross",
            idempotencyKey,
            fromCurrency,
            toCurrency,
            fromAmountMinor: BigInt(fromAmountMinor),
            asOf,
          });

          return loadFxExecuteQuoteSnapshotById({
            currenciesService,
            fxQuotes,
            quoteId: quote.id,
          });
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
      loadQuoteSnapshotById({ quoteId }) {
        return loadFxExecuteQuoteSnapshotById({
          currenciesService,
          fxQuotes,
          quoteId,
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForFxExecute({
        quoteId,
        fxExecuteDocumentId,
        at,
      }) {
        await markQuoteUsedForRef({
          fxQuotes,
          quoteId,
          usedByRef: `fx_execute:${fxExecuteDocumentId}`,
          at,
        });
      },
    },
  };
}
