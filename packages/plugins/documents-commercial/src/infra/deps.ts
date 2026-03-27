import type { CurrenciesService } from "@bedrock/currencies";
import { normalizeFinancialLine } from "@bedrock/documents/contracts";
import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";
import {
  DocumentValidationError,
  type DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ServiceError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";
import type {
  CreateQuoteInput,
  GetQuoteDetailsInput,
  MarkQuoteUsedInput,
  QuoteDetailsRecord,
  QuoteRecord,
} from "@bedrock/treasury/contracts";

import type { CommercialModuleDeps } from "../documents/internal/types";
import type { QuoteSnapshot } from "../validation";
import { QuoteSnapshotSchema } from "../validation";

const INCOMING_INVOICE_DOC_TYPE = "incoming_invoice";
const PAYMENT_ORDER_DOC_TYPE = "payment_order";

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

interface CommercialTreasuryQuotesPort {
  getQuoteDetails(input: GetQuoteDetailsInput): Promise<QuoteDetailsRecord>;
  markQuoteUsed(input: MarkQuoteUsedInput): Promise<QuoteRecord>;
  createQuote(input: CreateQuoteInput): Promise<QuoteRecord>;
}

interface CommercialLedgerReadPort {
  getOperationDetails(
    operationId: string,
  ): Promise<LedgerOperationDetails | null>;
}

async function loadDocumentByType(input: {
  runtime: DocumentModuleRuntime;
  documentId: string;
  docType: string;
  forUpdate?: boolean;
}) {
  const document = await input.runtime.documents.getDocumentByType({
    documentId: input.documentId,
    docType: input.docType,
    forUpdate: input.forUpdate,
  });

  if (!document) {
    throw new DocumentValidationError(
      `Document not found: ${input.docType}/${input.documentId}`,
    );
  }

  return document;
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
  details: QuoteDetailsRecord;
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

async function loadQuoteSnapshotRecord(input: {
  currenciesService: CurrenciesService;
  treasuryQuotes: CommercialTreasuryQuotesPort;
  quoteRef: string;
}): Promise<QuoteSnapshot> {
  try {
    const details = await input.treasuryQuotes.getQuoteDetails({
      quoteRef: input.quoteRef,
    });
    const snapshotWithoutHash = await buildQuoteSnapshotBase({
      currenciesService: input.currenciesService,
      details,
    });

    return QuoteSnapshotSchema.parse({
      ...snapshotWithoutHash,
      quoteRef: input.quoteRef,
      snapshotHash: buildQuoteSnapshotHash({
        ...snapshotWithoutHash,
        quoteRef: input.quoteRef,
      }),
    });
  } catch (error) {
    rethrowAsDocumentValidationError(error);
  }
}

async function markQuoteUsedForRef(input: {
  treasuryQuotes: CommercialTreasuryQuotesPort;
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

export function createCommercialDocumentDeps(input: {
  currenciesService: CurrenciesService;
  treasuryQuotes: CommercialTreasuryQuotesPort;
  ledgerReadService: CommercialLedgerReadPort;
  requisitesService: {
    resolveBindings(input: {
      requisiteIds: string[];
    }): Promise<
      {
        requisiteId: string;
        bookId: string;
        organizationId: string;
        currencyCode: string;
        postingAccountNo: string;
        bookAccountInstanceId: string;
      }[]
    >;
  };
  partiesService: {
    customers: {
      findById(customerId: string): Promise<{ id: string }>;
    };
    counterparties: {
      findById(counterpartyId: string): Promise<{
        id: string;
        customerId?: string | null;
        groupIds?: string[];
      }>;
    };
    counterpartyGroups: {
      listByCustomerId(customerId: string): Promise<
        {
          id: string;
          customerId: string | null;
        }[]
      >;
    };
  };
}): CommercialModuleDeps {
  const {
    currenciesService,
    treasuryQuotes,
    ledgerReadService,
    requisitesService,
    partiesService,
  } =
    input;

  return {
    ledgerRead: {
      getOperationDetails(operationId) {
        return ledgerReadService.getOperationDetails(operationId);
      },
    },
    quoteSnapshot: {
      async loadQuoteSnapshot({ quoteRef }) {
        return loadQuoteSnapshotRecord({
          currenciesService,
          treasuryQuotes,
          quoteRef,
        });
      },
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

          return loadQuoteSnapshotRecord({
            currenciesService,
            treasuryQuotes,
            quoteRef: quote.id,
          });
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
    },
    quoteUsage: {
      async markQuoteUsedForPaymentOrder({
        quoteId,
        paymentOrderDocumentId,
        at,
      }) {
        await markQuoteUsedForRef({
          treasuryQuotes,
          quoteId,
          usedByRef: `payment_order:${paymentOrderDocumentId}`,
          at,
        });
      },
    },
    requisiteBindings: {
      async resolveBinding(organizationRequisiteId: string) {
        const [binding] = await requisitesService.resolveBindings({
          requisiteIds: [organizationRequisiteId],
        });

        return binding ?? null;
      },
    },
    partyReferences: {
      async assertCustomerExists(customerId) {
        try {
          await partiesService.customers.findById(customerId);
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
      async assertCounterpartyExists(counterpartyId) {
        try {
          await partiesService.counterparties.findById(counterpartyId);
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
      async assertCounterpartyLinkedToCustomer({ customerId, counterpartyId }) {
        try {
          const [counterparty, customerGroups] = await Promise.all([
            partiesService.counterparties.findById(counterpartyId),
            partiesService.counterpartyGroups.listByCustomerId(customerId),
          ]);
          const customerGroupIds = new Set(customerGroups.map((group) => group.id));
          const linkedViaGroup = (counterparty.groupIds ?? []).some((groupId) =>
            customerGroupIds.has(groupId),
          );

          if (!linkedViaGroup) {
            throw new DocumentValidationError(
              `Counterparty ${counterpartyId} is not linked to customer ${customerId}`,
            );
          }
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
    },
    documentRelations: {
      loadIncomingInvoice({
        runtime,
        incomingInvoiceDocumentId,
        forUpdate = false,
      }) {
        return loadDocumentByType({
          runtime,
          documentId: incomingInvoiceDocumentId,
          docType: INCOMING_INVOICE_DOC_TYPE,
          forUpdate,
        });
      },
      loadPaymentOrder({
        runtime,
        paymentOrderDocumentId,
        forUpdate = false,
      }) {
        return loadDocumentByType({
          runtime,
          documentId: paymentOrderDocumentId,
          docType: PAYMENT_ORDER_DOC_TYPE,
          forUpdate,
        });
      },
      async listIncomingInvoicePaymentOrders({
        runtime,
        incomingInvoiceDocumentId,
      }) {
        return runtime.documents.listIncomingLinkedDocuments({
          toDocumentId: incomingInvoiceDocumentId,
          linkType: "parent",
          fromDocType: PAYMENT_ORDER_DOC_TYPE,
        });
      },
      async listPaymentOrderResolutions({
        runtime,
        paymentOrderDocumentId,
      }) {
        return runtime.documents.listIncomingLinkedDocuments({
          toDocumentId: paymentOrderDocumentId,
          linkType: "depends_on",
          fromDocType: PAYMENT_ORDER_DOC_TYPE,
        });
      },
    },
  };
}
