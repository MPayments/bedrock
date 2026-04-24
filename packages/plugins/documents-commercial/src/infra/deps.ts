import type { CalculationDetails } from "@bedrock/calculations/contracts";
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
import type { QuoteSnapshot } from "../validation";
import { QuoteSnapshotSchema } from "../validation";

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";
const DEAL_CALCULATION_FINANCIAL_LINE_KINDS = new Set([
  "adjustment",
  "fee_revenue",
  "pass_through",
  "provider_fee_expense",
  "spread_revenue",
] as const);

function isCommercialCalculationFinancialLineKind(
  kind: CalculationDetails["lines"][number]["kind"],
): kind is
  | "adjustment"
  | "fee_revenue"
  | "pass_through"
  | "provider_fee_expense"
  | "spread_revenue" {
  return DEAL_CALCULATION_FINANCIAL_LINE_KINDS.has(
    kind as typeof DEAL_CALCULATION_FINANCIAL_LINE_KINDS extends Set<infer T>
      ? T
      : never,
  );
}

function isCommercialCalculationFinancialLine(
  line: CalculationDetails["lines"][number],
): line is CalculationDetails["lines"][number] & {
  kind: CommercialDealFxContext["financialLines"][number]["bucket"];
} {
  return isCommercialCalculationFinancialLineKind(line.kind);
}

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

export function createCommercialDocumentDeps(input: {
  currenciesService: CurrenciesService;
  dealReads?: Pick<
    { findWorkflowById(id: string): Promise<DealWorkflowProjection | null> },
    "findWorkflowById"
  >;
  calculationReads?: Pick<
    { findById(id: string): Promise<CalculationDetails | null> },
    "findById"
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
    calculationReads,
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
          const calculationId = workflow.summary.calculationId ?? null;

          if (!calculationId || !calculationReads) {
            return {
              calculationCurrency: null,
              calculationId,
              dealId,
              dealType: workflow.summary.type,
              financialLines: [] as CommercialDealFxContext["financialLines"],
              fundingResolution: workflow.fundingResolution,
              hasConvertLeg,
              originalAmountMinor: null,
              quoteSnapshot: null,
              totalAmountMinor: null,
            };
          }

          const calculation = await calculationReads.findById(calculationId);

          if (!calculation) {
            return {
              calculationCurrency: null,
              calculationId,
              dealId,
              dealType: workflow.summary.type,
              financialLines: [] as CommercialDealFxContext["financialLines"],
              fundingResolution: workflow.fundingResolution,
              hasConvertLeg,
              originalAmountMinor: null,
              quoteSnapshot: null,
              totalAmountMinor: null,
            };
          }

          const currencyIds = [
            calculation.currentSnapshot.calculationCurrencyId,
            ...new Set(
              calculation.lines
                .filter((line: CalculationDetails["lines"][number]) =>
                  isCommercialCalculationFinancialLineKind(line.kind),
                )
                .map(
                  (line: CalculationDetails["lines"][number]) =>
                    line.currencyId,
                ),
            ),
          ];
          const currenciesById = new Map(
            await Promise.all(
              currencyIds.map(async (currencyId) => {
                return [
                  currencyId,
                  await currenciesService.findById(currencyId),
                ] as const;
              }),
            ),
          );
          const calculationCurrency = currenciesById.get(
            calculation.currentSnapshot.calculationCurrencyId,
          );

          if (!calculationCurrency) {
            throw new DocumentValidationError(
              `Calculation currency ${calculation.currentSnapshot.calculationCurrencyId} is missing`,
            );
          }

          const financialLines: CommercialDealFxContext["financialLines"] =
            calculation.lines
              .filter(isCommercialCalculationFinancialLine)
              .map((line) => {
                const currency = currenciesById.get(line.currencyId);

                if (!currency) {
                  throw new DocumentValidationError(
                    `Calculation line currency ${line.currencyId} is missing`,
                  );
                }

                return {
                  amountMinor: BigInt(line.amountMinor),
                  bucket: line.kind,
                  currency: currency.code,
                  id: `calculation:${line.id}`,
                  settlementMode: "in_ledger" as const,
                  source: "rule" as const,
                };
              })
              .filter((line) => line.amountMinor !== 0n);
          const storedQuoteSnapshot = calculation.currentSnapshot.quoteSnapshot;
          const parsedStoredQuoteSnapshot = storedQuoteSnapshot
            ? QuoteSnapshotSchema.safeParse(storedQuoteSnapshot)
            : null;
          const quoteSnapshot = parsedStoredQuoteSnapshot?.success
            ? parsedStoredQuoteSnapshot.data
            : calculation.currentSnapshot.fxQuoteId
              ? await loadQuoteSnapshotRecord({
                  currenciesService,
                  treasuryQuotes,
                  quoteRef: calculation.currentSnapshot.fxQuoteId,
                })
              : null;

          return {
            calculationCurrency: calculationCurrency.code,
            calculationId,
            dealId,
            dealType: workflow.summary.type,
            financialLines,
            fundingResolution: workflow.fundingResolution,
            hasConvertLeg,
            originalAmountMinor:
              calculation.currentSnapshot.originalAmountMinor,
            quoteSnapshot,
            totalAmountMinor: calculation.currentSnapshot.totalAmountMinor,
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
