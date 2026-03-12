import { and, eq } from "drizzle-orm";

import {
  normalizeFinancialLine,
  type FinancialLine,
  type FinancialLineBucket,
} from "@bedrock/application/commercial-documents/contracts";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/application/accounting/posting-contracts";
import type {
  DocumentPostingPlanRequest,
} from "@bedrock/application/accounting";
import {
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
} from "@bedrock/application/documents/module-kit";
import { schema as documentsSchema, type Document } from "@bedrock/application/documents/schema";
import { type DocumentModuleContext, DocumentValidationError } from "@bedrock/application/documents";
import { schema as fxSchema } from "@bedrock/application/fx/schema";
import { canonicalJson, isUuidLike, sha256Hex } from "@bedrock/common";
import type { Database, Transaction } from "@bedrock/common/db/types";

import {
  AcceptancePayloadSchema,
  ExchangePayloadSchema,
  InvoicePayloadSchema,
  QuoteSnapshotSchema,
  type AcceptancePayload,
  type ExchangePayload,
  type InvoicePayload,
  type QuoteSnapshot,
} from "../../validation";
import type { CommercialModuleDeps } from "./types";

type Queryable = Database | Transaction;

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";

export function buildQuoteSnapshotHash(snapshot: Omit<QuoteSnapshot, "snapshotHash">) {
  return sha256Hex(canonicalJson(snapshot));
}

function minorToAmountString(amountMinor: bigint, precision: number): string {
  const normalizedPrecision = Math.max(0, Math.trunc(precision));
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const digits = absolute.toString().padStart(normalizedPrecision + 1, "0");
  const integerPart = digits.slice(0, digits.length - normalizedPrecision);
  const fractionPart =
    normalizedPrecision > 0 ? digits.slice(-normalizedPrecision) : "";
  const trimmedFraction = fractionPart.replace(/0+$/, "");
  const sign = amountMinor < 0n ? "-" : "";

  if (trimmedFraction.length === 0) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart}.${trimmedFraction}`;
}

export async function loadQuoteSnapshot(input: {
  db: Queryable;
  currenciesService: CommercialModuleDeps["currenciesService"];
  quoteRef: string;
}): Promise<QuoteSnapshot> {
  const { db, currenciesService, quoteRef } = input;

  let quote: typeof fxSchema.fxQuotes.$inferSelect | null = null;

  if (isUuidLike(quoteRef)) {
    const [byId] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.id, quoteRef))
      .limit(1);
    const [byIdempotency] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.idempotencyKey, quoteRef))
      .limit(1);

    if (byId && byIdempotency && byId.id !== byIdempotency.id) {
      throw new DocumentValidationError(
        `quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`,
      );
    }

    quote = byId ?? byIdempotency ?? null;
  } else {
    const [byIdempotency] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.idempotencyKey, quoteRef))
      .limit(1);
    quote = byIdempotency ?? null;
  }

  if (!quote) {
    throw new DocumentValidationError(`Quote not found: ${quoteRef}`);
  }

  const [fromCurrency, toCurrency] = await Promise.all([
    currenciesService.findById(quote.fromCurrencyId),
    currenciesService.findById(quote.toCurrencyId),
  ]);
  const legs = await db
    .select()
    .from(fxSchema.fxQuoteLegs)
    .where(eq(fxSchema.fxQuoteLegs.quoteId, quote.id))
    .orderBy(fxSchema.fxQuoteLegs.idx);
  const financialLineRows = await db
    .select()
    .from(fxSchema.fxQuoteFinancialLines)
    .where(eq(fxSchema.fxQuoteFinancialLines.quoteId, quote.id))
    .orderBy(fxSchema.fxQuoteFinancialLines.idx);
  const uniqueCurrencyIds = [
    ...new Set([
      ...legs.flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId]),
      ...financialLineRows.map((row) => row.currencyId),
    ]),
  ];
  const currencyById = new Map<string, { code: string; precision: number }>();
  await Promise.all(
    uniqueCurrencyIds.map(async (currencyId) => {
      const currency =
        currencyId === fromCurrency.id
          ? fromCurrency
          : currencyId === toCurrency.id
            ? toCurrency
            : await currenciesService.findById(currencyId);
      currencyById.set(currencyId, {
        code: currency.code,
        precision: currency.precision,
      });
    }),
  );

  const snapshotWithoutHash = {
    quoteId: quote.id,
    quoteRef,
    idempotencyKey: quote.idempotencyKey,
    fromCurrency: fromCurrency.code,
    toCurrency: toCurrency.code,
    fromAmountMinor: quote.fromAmountMinor.toString(),
    toAmountMinor: quote.toAmountMinor.toString(),
    pricingMode: quote.pricingMode,
    rateNum: quote.rateNum.toString(),
    rateDen: quote.rateDen.toString(),
    expiresAt: quote.expiresAt.toISOString(),
    pricingTrace: (quote.pricingTrace ?? {}) as Record<string, unknown>,
    legs: legs.map((leg) => ({
      idx: leg.idx,
      fromCurrency: currencyById.get(leg.fromCurrencyId)!.code,
      toCurrency: currencyById.get(leg.toCurrencyId)!.code,
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    })),
    financialLines: financialLineRows.map((line) => {
      const currency = currencyById.get(line.currencyId)!;
      const normalizedLine = normalizeFinancialLine({
        id: `quote_financial_line:${line.quoteId}:${line.idx}`,
        bucket: line.bucket as FinancialLineBucket,
        currency: currency.code,
        amountMinor: line.amountMinor,
        source: line.source as FinancialLine["source"],
        settlementMode: line.settlementMode as FinancialLine["settlementMode"],
        memo: line.memo ?? undefined,
        metadata: line.metadata ?? undefined,
      });

      return {
        ...normalizedLine,
        amount: minorToAmountString(normalizedLine.amountMinor, currency.precision),
        amountMinor: normalizedLine.amountMinor.toString(),
        settlementMode: normalizedLine.settlementMode ?? "in_ledger",
      };
    }),
  } satisfies Omit<QuoteSnapshot, "snapshotHash">;

  return QuoteSnapshotSchema.parse({
    ...snapshotWithoutHash,
    snapshotHash: buildQuoteSnapshotHash(snapshotWithoutHash),
  });
}

export async function resolveOrganizationBinding(
  deps: CommercialModuleDeps,
  organizationRequisiteId: string,
) {
  const [binding] = await deps.requisitesService.resolveBindings({
    requisiteIds: [organizationRequisiteId],
  });

  if (!binding) {
    throw new DocumentValidationError(
      "Organization requisite binding is missing",
    );
  }

  return binding;
}

async function loadDocumentByType(
  db: Queryable,
  documentId: string,
  docType: string,
  forUpdate = false,
) {
  const query = db
    .select()
    .from(documentsSchema.documents)
    .where(
      and(
        eq(documentsSchema.documents.id, documentId),
        eq(documentsSchema.documents.docType, docType),
      ),
    )
    .limit(1);
  const [document] = forUpdate ? await query.for("update") : await query;

  if (!document) {
    throw new DocumentValidationError(
      `Document not found: ${docType}/${documentId}`,
    );
  }

  return document;
}

export async function loadInvoice(
  db: Queryable,
  invoiceDocumentId: string,
  forUpdate = false,
) {
  return loadDocumentByType(db, invoiceDocumentId, INVOICE_DOC_TYPE, forUpdate);
}

export async function getInvoiceExchangeChild(
  db: Queryable,
  invoiceDocumentId: string,
) {
  const [row] = await db
    .select({
      document: documentsSchema.documents,
    })
    .from(documentsSchema.documentLinks)
    .innerJoin(
      documentsSchema.documents,
      eq(documentsSchema.documents.id, documentsSchema.documentLinks.fromDocumentId),
    )
    .where(
      and(
        eq(documentsSchema.documentLinks.toDocumentId, invoiceDocumentId),
        eq(documentsSchema.documentLinks.linkType, "parent"),
        eq(documentsSchema.documents.docType, EXCHANGE_DOC_TYPE),
      ),
    )
    .limit(1);

  return row?.document ?? null;
}

export async function getInvoiceAcceptanceChild(
  db: Queryable,
  invoiceDocumentId: string,
) {
  const [row] = await db
    .select({
      document: documentsSchema.documents,
    })
    .from(documentsSchema.documentLinks)
    .innerJoin(
      documentsSchema.documents,
      eq(documentsSchema.documents.id, documentsSchema.documentLinks.fromDocumentId),
    )
    .where(
      and(
        eq(documentsSchema.documentLinks.toDocumentId, invoiceDocumentId),
        eq(documentsSchema.documentLinks.linkType, "parent"),
        eq(documentsSchema.documents.docType, ACCEPTANCE_DOC_TYPE),
      ),
    )
    .limit(1);

  return row?.document ?? null;
}

export async function getExchangeAcceptance(
  db: Queryable,
  exchangeDocumentId: string,
) {
  const [row] = await db
    .select({
      document: documentsSchema.documents,
    })
    .from(documentsSchema.documentLinks)
    .innerJoin(
      documentsSchema.documents,
      eq(documentsSchema.documents.id, documentsSchema.documentLinks.fromDocumentId),
    )
    .where(
      and(
        eq(documentsSchema.documentLinks.toDocumentId, exchangeDocumentId),
        eq(documentsSchema.documentLinks.linkType, "depends_on"),
        eq(documentsSchema.documents.docType, ACCEPTANCE_DOC_TYPE),
      ),
    )
    .limit(1);

  return row?.document ?? null;
}

export function requirePostedDocument(
  document: Pick<Document, "docType" | "postingStatus" | "lifecycleStatus">,
) {
  if (
    document.lifecycleStatus !== "active" ||
    document.postingStatus !== "posted"
  ) {
    throw new DocumentValidationError(
      `${document.docType} must be active and posted`,
    );
  }
}

export async function markQuoteUsedForInvoice(input: {
  db: Queryable;
  quoteId: string;
  invoiceDocumentId: string;
  at: Date;
}) {
  const [quote] = await input.db
    .select()
    .from(fxSchema.fxQuotes)
    .where(eq(fxSchema.fxQuotes.id, input.quoteId))
    .limit(1);

  if (!quote) {
    throw new DocumentValidationError(`Quote not found: ${input.quoteId}`);
  }

  const expectedUsedByRef = `invoice:${input.invoiceDocumentId}`;
  if (quote.status === "used" && quote.usedByRef === expectedUsedByRef) {
    return quote;
  }

  if (quote.status !== "active") {
    throw new DocumentValidationError(
      `Quote ${input.quoteId} is not active for invoice posting`,
    );
  }

  if (quote.expiresAt.getTime() < input.at.getTime()) {
    throw new DocumentValidationError(`Quote ${input.quoteId} is expired`);
  }

  const [updated] = await input.db
    .update(fxSchema.fxQuotes)
    .set({
      status: "used",
      usedByRef: expectedUsedByRef,
      usedAt: input.at,
    })
    .where(
      and(
        eq(fxSchema.fxQuotes.id, input.quoteId),
        eq(fxSchema.fxQuotes.status, "active"),
      ),
    )
    .returning();

  if (updated) {
    return updated;
  }

  const [reloaded] = await input.db
    .select()
    .from(fxSchema.fxQuotes)
    .where(eq(fxSchema.fxQuotes.id, input.quoteId))
    .limit(1);

  if (!reloaded) {
    throw new DocumentValidationError(`Quote not found: ${input.quoteId}`);
  }

  if (reloaded.status === "used" && reloaded.usedByRef === expectedUsedByRef) {
    return reloaded;
  }

  if (reloaded.status === "used") {
    throw new DocumentValidationError(
      `Quote ${input.quoteId} is already used by ${reloaded.usedByRef ?? "another document"}`,
    );
  }

  throw new DocumentValidationError(
    `Quote ${input.quoteId} could not be locked for invoice posting`,
  );
}

type FinancialLinePostingPhase = "direct" | "reserve" | "finalize";

function templateForLine(
  line: FinancialLine,
  postingPhase: FinancialLinePostingPhase,
): {
  templateKey: string;
  amountMinor: bigint;
} | null {
  if (line.bucket === "provider_fee_expense") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (postingPhase === "reserve") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.bucket === "pass_through") {
    if (postingPhase === "finalize") {
      return null;
    }

    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (postingPhase === "finalize") {
    if (line.amountMinor > 0n) {
      return {
        templateKey:
          line.bucket === "spread_revenue"
            ? POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME_FROM_RESERVE
            : line.bucket === "adjustment"
              ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_FROM_RESERVE
              : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
        amountMinor: line.amountMinor,
      };
    }

    return {
      templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE,
      amountMinor: -line.amountMinor,
    };
  }

  if (line.bucket === "adjustment") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.amountMinor > 0n) {
    return {
      templateKey:
        line.bucket === "spread_revenue"
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
      amountMinor: line.amountMinor,
    };
  }

  return {
    templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
    amountMinor: -line.amountMinor,
  };
}

export function buildFinancialLineRequests(input: {
  document: Pick<Document, "id" | "occurredAt">;
  bookId: string;
  customerId: string;
  orderId: string;
  counterpartyId: string;
  quoteRef: string;
  chainId: string;
  lines: FinancialLine[];
  includeCustomerLines: boolean;
  includeProviderLines: boolean;
  postingPhase: FinancialLinePostingPhase;
}): DocumentPostingPlanRequest[] {
  const requests: DocumentPostingPlanRequest[] = [];

  input.lines.forEach((rawLine, index) => {
    const line = normalizeFinancialLine(rawLine);
    if (line.bucket === "provider_fee_expense" && !input.includeProviderLines) {
      return;
    }
    if (
      line.bucket !== "provider_fee_expense" &&
      !input.includeCustomerLines
    ) {
      return;
    }

    const postingTemplate = templateForLine(line, input.postingPhase);
    if (!postingTemplate) {
      return;
    }

    const { templateKey, amountMinor } = postingTemplate;
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: templateKey as any,
        bookId: input.bookId,
        currency: line.currency,
        amountMinor,
        dimensions: {
          customerId: input.customerId,
          orderId: input.orderId,
          feeBucket: line.bucket,
          ...(line.bucket === "provider_fee_expense"
            ? {
                counterpartyId: input.counterpartyId,
              }
            : {}),
        },
        refs: {
          quoteRef: input.quoteRef,
          chainId: input.chainId,
          componentId: line.id,
          componentIndex: String(index + 1),
        },
        memo: line.memo ?? null,
      }),
    );
  });

  return requests;
}

export function buildDirectInvoicePostingPlan(input: {
  document: Document;
  payload: Extract<InvoicePayload, { mode: "direct" }>;
  bookId: string;
}) {
  const chainId = `invoice:${input.document.id}`;
  const quoteRef = `invoice:${input.document.id}`;

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.COMMERCIAL_INVOICE_DIRECT,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests: [
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          customerId: input.payload.customerId,
          orderId: input.document.id,
        },
        refs: {
          quoteRef,
          chainId,
        },
        memo: input.payload.memo ?? null,
      }),
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          orderId: input.document.id,
        },
        refs: {
          quoteRef,
          chainId,
          payoutCounterpartyId: input.payload.counterpartyId,
        },
        memo: input.payload.memo ?? null,
      }),
      ...buildFinancialLineRequests({
        document: input.document,
        bookId: input.bookId,
        customerId: input.payload.customerId,
        orderId: input.document.id,
        counterpartyId: input.payload.counterpartyId,
        quoteRef,
        chainId,
        lines: input.payload.financialLines.map((line) =>
          normalizeFinancialLine({
            id: line.id,
            bucket: line.bucket,
            currency: line.currency,
            amountMinor: BigInt(line.amountMinor),
            source: line.source,
            settlementMode: line.settlementMode,
            memo: line.memo ?? undefined,
            metadata: line.metadata ?? undefined,
          }),
        ),
        includeCustomerLines: true,
        includeProviderLines: true,
        postingPhase: "direct",
      }),
    ],
  });
}

export async function buildExchangeInvoicePostingPlan(input: {
  context: DocumentModuleContext;
  document: Document;
  payload: Extract<InvoicePayload, { mode: "exchange" }>;
  bookId: string;
}) {
  const chainId = `invoice:${input.document.id}`;
  await markQuoteUsedForInvoice({
    db: input.context.db,
    quoteId: input.payload.quoteSnapshot.quoteId,
    invoiceDocumentId: input.document.id,
    at: input.context.now,
  });

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.COMMERCIAL_INVOICE_RESERVE,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests: [
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        bookId: input.bookId,
        currency: input.payload.quoteSnapshot.fromCurrency,
        amountMinor: BigInt(input.payload.quoteSnapshot.fromAmountMinor),
        dimensions: {
          customerId: input.payload.customerId,
          orderId: input.document.id,
        },
        refs: {
          quoteRef: input.payload.quoteSnapshot.quoteRef,
          chainId,
        },
        memo: input.payload.memo ?? null,
      }),
      ...buildFinancialLineRequests({
        document: input.document,
        bookId: input.bookId,
        customerId: input.payload.customerId,
        orderId: input.document.id,
        counterpartyId: input.payload.counterpartyId,
        quoteRef: input.payload.quoteSnapshot.quoteRef,
        chainId,
        lines: input.payload.quoteSnapshot.financialLines.map((line) =>
          normalizeFinancialLine({
            ...line,
            amountMinor: BigInt(line.amountMinor),
          }),
        ),
        includeCustomerLines: true,
        includeProviderLines: false,
        postingPhase: "reserve",
      }),
    ],
  });
}

export function buildExchangePostingPlan(input: {
  document: Document;
  payload: ExchangePayload;
  bookId: string;
}) {
  const chainId = `invoice:${input.payload.invoiceDocumentId}`;
  const requests: DocumentPostingPlanRequest[] = [];

  for (const leg of input.payload.quoteSnapshot.legs) {
    const counterpartyId =
      leg.executionCounterpartyId ?? input.payload.counterpartyId;
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_OUT,
        bookId: input.bookId,
        currency: leg.fromCurrency,
        amountMinor: BigInt(leg.fromAmountMinor),
        dimensions: {
          orderId: input.payload.invoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.payload.quoteSnapshot.quoteRef,
          chainId,
          legIndex: String(leg.idx),
        },
        memo: input.payload.memo ?? null,
      }),
    );
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_IN,
        bookId: input.bookId,
        currency: leg.toCurrency,
        amountMinor: BigInt(leg.toAmountMinor),
        dimensions: {
          orderId: input.payload.invoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.payload.quoteSnapshot.quoteRef,
          chainId,
          legIndex: String(leg.idx),
        },
        memo: input.payload.memo ?? null,
      }),
    );
  }

  requests.push(
    buildDocumentPostingRequest(input.document, {
      templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
      bookId: input.bookId,
      currency: input.payload.quoteSnapshot.toCurrency,
      amountMinor: BigInt(input.payload.quoteSnapshot.toAmountMinor),
      dimensions: {
        orderId: input.payload.invoiceDocumentId,
      },
      refs: {
        quoteRef: input.payload.quoteSnapshot.quoteRef,
        chainId,
        payoutCounterpartyId: input.payload.counterpartyId,
      },
      memo: input.payload.memo ?? null,
    }),
  );

  requests.push(
    ...buildFinancialLineRequests({
      document: input.document,
      bookId: input.bookId,
      customerId: input.payload.customerId,
      orderId: input.payload.invoiceDocumentId,
      counterpartyId: input.payload.counterpartyId,
      quoteRef: input.payload.quoteSnapshot.quoteRef,
      chainId,
      lines: input.payload.quoteSnapshot.financialLines.map((line) =>
        normalizeFinancialLine({
          ...line,
          amountMinor: BigInt(line.amountMinor),
        }),
      ),
      includeCustomerLines: true,
      includeProviderLines: true,
      postingPhase: "finalize",
    }),
  );

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.TREASURY_FX_EXECUTED,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests,
  });
}

export function parseInvoicePayload(document: Document) {
  return parseDocumentPayload(InvoicePayloadSchema, document);
}

export function parseExchangePayload(document: Document) {
  return parseDocumentPayload(ExchangePayloadSchema, document);
}

export function parseAcceptancePayload(document: Document) {
  return parseDocumentPayload(AcceptancePayloadSchema, document);
}
