import type { CalculationDetails } from "@bedrock/calculations/contracts";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { normalizeFinancialLine } from "@bedrock/documents/contracts";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import {
  DocumentValidationError,
  type DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ServiceError } from "@bedrock/shared/core/errors";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core/pagination";
import { minorToAmountString } from "@bedrock/shared/money";
import type {
  CreateQuoteInput,
  GetQuoteDetailsInput,
  MarkQuoteUsedInput,
  QuoteDetailsRecord,
  QuoteRecord,
  TreasuryOperationFact,
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
    kind as (typeof DEAL_CALCULATION_FINANCIAL_LINE_KINDS extends Set<infer T> ? T : never),
  );
}

function isCommercialCalculationFinancialLine(
  line: CalculationDetails["lines"][number],
): line is CalculationDetails["lines"][number] & {
  kind: CommercialDealFxContext["financialLines"][number]["bucket"];
} {
  return isCommercialCalculationFinancialLineKind(line.kind);
}

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

interface CommercialTreasuryQuotesPort {
  getQuoteDetails(
    input: GetQuoteDetailsInput,
  ): Promise<QuoteDetailsRecord>;
  markQuoteUsed(
    input: MarkQuoteUsedInput,
  ): Promise<QuoteRecord>;
  createQuote(
    input: CreateQuoteInput,
  ): Promise<QuoteRecord>;
}

interface CommercialTreasuryOperationFactsPort {
  listFacts(input: {
    dealId?: string;
    limit: number;
    offset: number;
    sortBy?: "createdAt" | "recordedAt";
    sortOrder?: "asc" | "desc";
  }): Promise<{
    data: TreasuryOperationFact[];
  }>;
}

type CommercialFinancialLineBucket =
  CommercialDealFxContext["financialLines"][number]["bucket"];

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

function mapActualFactBucket(input: {
  classification: unknown;
  family: unknown;
}): CommercialFinancialLineBucket | null {
  if (input.family === "provider_fee_expense") {
    return "provider_fee_expense";
  }

  if (input.family === "pass_through") {
    return "pass_through";
  }

  if (input.family === "adjustment") {
    return "adjustment";
  }

  if (input.family === "spread_revenue") {
    return "spread_revenue";
  }

  if (input.family === "fee_revenue") {
    return "fee_revenue";
  }

  if (input.classification === "pass_through") {
    return "pass_through";
  }

  if (input.classification === "adjustment") {
    return "adjustment";
  }

  if (input.classification === "revenue") {
    return "fee_revenue";
  }

  if (input.classification === "expense") {
    return "provider_fee_expense";
  }

  return null;
}

function selectLatestFactsByOperation(
  facts: TreasuryOperationFact[],
): TreasuryOperationFact[] {
  const factsByOperation = new Map<string, TreasuryOperationFact>();

  for (const fact of facts) {
    if (!factsByOperation.has(fact.operationId)) {
      factsByOperation.set(fact.operationId, fact);
    }
  }

  return [...factsByOperation.values()];
}

function buildActualFinancialLines(input: {
  currenciesById: Map<string, { code: string }>;
  facts: TreasuryOperationFact[];
}): CommercialDealFxContext["financialLines"] {
  const totals = new Map<
    string,
    {
      amountMinor: bigint;
      bucket: CommercialFinancialLineBucket;
      currency: string;
    }
  >();

  for (const fact of selectLatestFactsByOperation(input.facts)) {
    const metadata =
      fact.metadata && typeof fact.metadata === "object" ? fact.metadata : null;
    const amountBucket = mapActualFactBucket({
      classification: metadata?.classification,
      family: metadata?.componentFamily,
    });
    const feeBucket = mapActualFactBucket({
      classification: metadata?.feeClassification ?? "expense",
      family: metadata?.feeComponentFamily ?? metadata?.componentFamily,
    });

    if (fact.amountMinor && fact.currencyId && amountBucket) {
      const currency = input.currenciesById.get(fact.currencyId);

      if (!currency) {
        throw new DocumentValidationError(
          `Treasury fact amount currency ${fact.currencyId} is missing`,
        );
      }

      const key = `${amountBucket}:${currency.code}`;
      const bucket = totals.get(key) ?? {
        amountMinor: 0n,
        bucket: amountBucket,
        currency: currency.code,
      };
      bucket.amountMinor += BigInt(fact.amountMinor);
      totals.set(key, bucket);
    }

    if (fact.feeAmountMinor && fact.feeCurrencyId && feeBucket) {
      const currency = input.currenciesById.get(fact.feeCurrencyId);

      if (!currency) {
        throw new DocumentValidationError(
          `Treasury fact fee currency ${fact.feeCurrencyId} is missing`,
        );
      }

      const key = `${feeBucket}:${currency.code}`;
      const bucket = totals.get(key) ?? {
        amountMinor: 0n,
        bucket: feeBucket,
        currency: currency.code,
      };
      bucket.amountMinor += BigInt(fact.feeAmountMinor);
      totals.set(key, bucket);
    }
  }

  return [...totals.values()]
    .filter((line) => line.amountMinor !== 0n)
    .map((line) => ({
      amountMinor: line.amountMinor,
      bucket: line.bucket,
      currency: line.currency,
      id: `actual:${line.bucket}:${line.currency}`,
      settlementMode: "in_ledger" as const,
      source: "manual" as const,
    }));
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
  treasuryOperationFacts?: CommercialTreasuryOperationFactsPort;
  treasuryQuotes: CommercialTreasuryQuotesPort;
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
      findById(counterpartyId: string): Promise<{ id: string }>;
    };
  };
}): CommercialModuleDeps {
  const {
    calculationReads,
    currenciesService,
    dealReads,
    documentsReadModel,
    treasuryOperationFacts,
    treasuryQuotes,
    requisitesService,
    partiesService,
  } =
    input;

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

          const operationFacts = treasuryOperationFacts
            ? await treasuryOperationFacts.listFacts({
                dealId,
                limit: MAX_QUERY_LIST_LIMIT,
                offset: 0,
                sortBy: "recordedAt",
                sortOrder: "desc",
              })
            : { data: [] };
          const currencyIds = [
            calculation.currentSnapshot.calculationCurrencyId,
            ...new Set(
              calculation.lines
                .filter((line: CalculationDetails["lines"][number]) =>
                  isCommercialCalculationFinancialLineKind(line.kind),
                )
                .map((line: CalculationDetails["lines"][number]) => line.currencyId),
            ),
            ...new Set(
              operationFacts.data.flatMap((fact) =>
                [fact.currencyId, fact.feeCurrencyId].filter(
                  (currencyId): currencyId is string => Boolean(currencyId),
                ),
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
          const actualFinancialLines = buildActualFinancialLines({
            currenciesById,
            facts: operationFacts.data,
          });
          const storedQuoteSnapshot = calculation.currentSnapshot.quoteSnapshot;
          const parsedStoredQuoteSnapshot = storedQuoteSnapshot
            ? QuoteSnapshotSchema.safeParse(storedQuoteSnapshot)
            : null;
          const quoteSnapshot =
            parsedStoredQuoteSnapshot?.success
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
            actualFinancialLines,
            financialLines,
            fundingResolution: workflow.fundingResolution,
            hasConvertLeg,
            originalAmountMinor: calculation.currentSnapshot.originalAmountMinor,
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
      async markQuoteUsedForInvoice({
        quoteId,
        invoiceDocumentId,
        at,
      }) {
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
