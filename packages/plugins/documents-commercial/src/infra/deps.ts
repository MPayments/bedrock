import type { CurrenciesService } from "@bedrock/currencies";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import {
  DocumentValidationError,
  type DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";
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

import type {
  CommercialDealFxContext,
  CommercialModuleDeps,
} from "../documents/internal/types";
import { normalizeFinancialLine } from "../financial-lines";
import type { QuoteSnapshot } from "../validation";
import { QuoteSnapshotSchema } from "../validation";

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";

interface CommercialTreasuryQuotesPort {
  getQuoteDetails(input: GetQuoteDetailsInput): Promise<QuoteDetailsRecord>;
  markQuoteUsed(input: MarkQuoteUsedInput): Promise<QuoteRecord>;
  createQuote(input: CreateQuoteInput): Promise<QuoteRecord>;
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
  usedDocumentId?: string;
  at: Date;
}) {
  try {
    await input.treasuryQuotes.markQuoteUsed({
      quoteId: input.quoteId,
      usedByRef: input.usedByRef,
      usedDocumentId: input.usedDocumentId,
      at: input.at,
    });
  } catch (error) {
    rethrowAsDocumentValidationError(error);
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractAcceptedQuoteCommercialPricing(
  quoteSnapshot: QuoteSnapshot,
): {
  currency: string;
  customerPrincipalMinor: string;
  customerTotalMinor: string;
} | null {
  const metadata = readObject(quoteSnapshot.pricingTrace.metadata);
  const snapshot = readObject(metadata?.crmPricingSnapshot);
  const clientSide = readObject(snapshot?.clientSide);
  const customerPrincipalMinor = readString(clientSide?.clientPrincipalMinor);
  const customerTotalMinor = readString(clientSide?.customerTotalMinor);

  if (!customerPrincipalMinor || !customerTotalMinor) {
    return null;
  }

  return {
    currency: quoteSnapshot.fromCurrency,
    customerPrincipalMinor,
    customerTotalMinor,
  };
}

function mapQuoteFinancialLines(
  quoteSnapshot: QuoteSnapshot | null,
): CommercialDealFxContext["financialLines"] | null {
  return (
    quoteSnapshot?.financialLines.map((line) =>
      normalizeFinancialLine({
        amountMinor: BigInt(line.amountMinor),
        bucket: line.bucket,
        currency: line.currency,
        id: line.id,
        memo: line.memo ?? undefined,
        metadata: line.metadata,
        settlementMode: line.settlementMode,
        source: line.source,
      }),
    ) ?? null
  );
}

export function createCommercialDocumentDeps(input: {
  currenciesService: CurrenciesService;
  dealReads?: Pick<
    {
      findWorkflowById(id: string): Promise<DealWorkflowProjection | null>;
    },
    "findWorkflowById"
  >;
  documentsReadModel?: Pick<DocumentsReadModel, "findBusinessLinkByDocumentId">;
  treasuryQuotes: CommercialTreasuryQuotesPort;
  requisitesService: {
    resolveBindings(input: { requisiteIds: string[] }): Promise<
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
      findById(counterpartyId: string): Promise<{ id: string }>;
    };
  };
}): CommercialModuleDeps {
  const {
    currenciesService,
    dealReads,
    documentsReadModel,
    treasuryQuotes,
    requisitesService,
    partiesService,
  } = input;

  return {
    dealFx: {
      async resolveDealFxContext(dealId) {
        if (!dealReads) {
          return null;
        }

        try {
          const workflow = await dealReads.findWorkflowById(dealId);

          if (!workflow) {
            return null;
          }

          const hasConvertLeg = workflow.executionPlan.some(
            (leg: DealWorkflowProjection["executionPlan"][number]) =>
              leg.kind === "convert",
          );
          const acceptedQuoteId = workflow.acceptedQuote?.quoteId ?? null;
          const calculationId = workflow.summary.calculationId ?? null;
          const acceptedQuoteSnapshot = acceptedQuoteId
            ? await loadQuoteSnapshotRecord({
                currenciesService,
                treasuryQuotes,
                quoteRef: acceptedQuoteId,
              })
            : null;
          const acceptedQuotePricing = acceptedQuoteSnapshot
            ? extractAcceptedQuoteCommercialPricing(acceptedQuoteSnapshot)
            : null;

          return {
            calculationCurrency:
              acceptedQuotePricing?.currency ??
              acceptedQuoteSnapshot?.fromCurrency ??
              null,
            calculationId,
            dealId,
            dealType: workflow.summary.type,
            financialLines: mapQuoteFinancialLines(acceptedQuoteSnapshot) ?? [],
            fundingResolution: workflow.fundingResolution,
            hasConvertLeg,
            originalAmountMinor:
              acceptedQuotePricing?.customerPrincipalMinor ?? null,
            quoteSnapshot: acceptedQuoteSnapshot,
            totalAmountMinor: acceptedQuotePricing?.customerTotalMinor ?? null,
          };
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
      },
    },
    documentBusinessLinks: {
      async findDealIdByDocumentId(documentId) {
        if (!documentsReadModel) {
          return null;
        }

        try {
          return (
            (await documentsReadModel.findBusinessLinkByDocumentId(documentId))
              ?.dealId ?? null
          );
        } catch (error) {
          rethrowAsDocumentValidationError(error);
        }
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
      async markQuoteUsedForInvoice({ quoteId, invoiceDocumentId, at }) {
        await markQuoteUsedForRef({
          treasuryQuotes,
          quoteId,
          usedByRef: `invoice:${invoiceDocumentId}`,
          usedDocumentId: invoiceDocumentId,
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
    },
    documentRelations: {
      loadInvoice({ runtime, invoiceDocumentId, forUpdate = false }) {
        return loadDocumentByType({
          runtime,
          documentId: invoiceDocumentId,
          docType: INVOICE_DOC_TYPE,
          forUpdate,
        });
      },
      async getInvoiceExchangeChild({ runtime, invoiceDocumentId }) {
        return runtime.documents.findIncomingLinkedDocument({
          toDocumentId: invoiceDocumentId,
          linkType: "parent",
          fromDocType: EXCHANGE_DOC_TYPE,
        });
      },
      async getInvoiceAcceptanceChild({ runtime, invoiceDocumentId }) {
        return runtime.documents.findIncomingLinkedDocument({
          toDocumentId: invoiceDocumentId,
          linkType: "parent",
          fromDocType: ACCEPTANCE_DOC_TYPE,
        });
      },
      async getExchangeAcceptance({ runtime, exchangeDocumentId }) {
        return runtime.documents.findIncomingLinkedDocument({
          toDocumentId: exchangeDocumentId,
          linkType: "depends_on",
          fromDocType: ACCEPTANCE_DOC_TYPE,
        });
      },
    },
  };
}
