import type { CurrenciesService } from "@bedrock/currencies";
import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildQuoteSnapshotBase,
  buildQuoteSnapshotHash,
  rethrowAsDocumentValidationError,
} from "@bedrock/plugin-documents-sdk/module-kit";
import type {
  CreateQuoteInput,
  GetQuoteDetailsInput,
  MarkQuoteUsedInput,
  QuoteDetailsRecord,
  QuoteRecord,
} from "@bedrock/treasury/contracts";

import type { IfrsModuleDeps } from "../documents/internal/types";
import { FxExecuteQuoteSnapshotSchema } from "../validation";

const FX_EXECUTE_DOC_TYPE = "fx_execute";
const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

interface IfrsTreasuryQuotesPort {
  getQuoteDetails(input: GetQuoteDetailsInput): Promise<QuoteDetailsRecord>;
  markQuoteUsed(input: MarkQuoteUsedInput): Promise<QuoteRecord>;
  createQuote(input: CreateQuoteInput): Promise<QuoteRecord>;
}

interface IfrsLedgerReadPort {
  getOperationDetails(
    operationId: string,
  ): Promise<LedgerOperationDetails | null>;
}

async function loadFxExecuteQuoteSnapshotById(input: {
  currenciesService: CurrenciesService;
  treasuryQuotes: IfrsTreasuryQuotesPort;
  quoteId: string;
}) {
  try {
    const details = await input.treasuryQuotes.getQuoteDetails({
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
  treasuryQuotes: IfrsTreasuryQuotesPort;
  quoteId: string;
  usedByRef: string;
  at: Date;
}) {
  try {
    await input.treasuryQuotes.markQuoteUsed({
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
  treasuryQuotes: IfrsTreasuryQuotesPort;
  ledgerReadService: IfrsLedgerReadPort;
  requisitesService: IfrsModuleDeps["requisitesService"];
}): IfrsModuleDeps {
  const {
    currenciesService,
    treasuryQuotes,
    ledgerReadService,
    requisitesService,
  } = input;

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
          const quote = await treasuryQuotes.createQuote({
            mode: "auto_cross",
            idempotencyKey,
            fromCurrency,
            toCurrency,
            fromAmountMinor: BigInt(fromAmountMinor),
            asOf,
          });

          return loadFxExecuteQuoteSnapshotById({
            currenciesService,
            treasuryQuotes,
            quoteId: quote.id,
          });
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
      loadQuoteSnapshotById({ quoteId }) {
        return loadFxExecuteQuoteSnapshotById({
          currenciesService,
          treasuryQuotes,
          quoteId,
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForFxExecute({ quoteId, fxExecuteDocumentId, at }) {
        await markQuoteUsedForRef({
          treasuryQuotes,
          quoteId,
          usedByRef: `fx_execute:${fxExecuteDocumentId}`,
          at,
        });
      },
    },
  };
}
