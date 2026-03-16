import { and, eq } from "drizzle-orm";

import type { CurrenciesService } from "@bedrock/currencies";
import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import { schema as fxSchema } from "@bedrock/fx/schema";
import { sha256Hex } from "@bedrock/platform/crypto";
import type {
  Queryable,
} from "@bedrock/platform/persistence";
import {
  DocumentValidationError,
  type DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { isUuidLike } from "@bedrock/shared/core/uuid";
import { minorToAmountString } from "@bedrock/shared/money";

import type { CommercialModuleDeps } from "../documents/internal/types";
import type { QuoteSnapshot } from "../validation";
import { QuoteSnapshotSchema } from "../validation";

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
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

async function withQueryable<TResult>(
  runtime: DocumentModuleRuntime,
  run: (db: Queryable) => Promise<TResult>,
) {
  return runtime.withQueryable((queryable) => run(queryable as Queryable));
}

async function loadQuoteRecordByRef(input: {
  runtime: DocumentModuleRuntime;
  quoteRef: string;
}) {
  const { quoteRef } = input;
  let quote: typeof fxSchema.fxQuotes.$inferSelect | null = null;

  if (isUuidLike(quoteRef)) {
    const [byId, byIdempotency] = await withQueryable(
      input.runtime,
      async (db) => {
        const [recordById] = await db
          .select()
          .from(fxSchema.fxQuotes)
          .where(eq(fxSchema.fxQuotes.id, quoteRef))
          .limit(1);
        const [recordByIdempotency] = await db
          .select()
          .from(fxSchema.fxQuotes)
          .where(eq(fxSchema.fxQuotes.idempotencyKey, quoteRef))
          .limit(1);
        return [recordById ?? null, recordByIdempotency ?? null] as const;
      },
    );

    if (byId && byIdempotency && byId.id !== byIdempotency.id) {
      throw new DocumentValidationError(
        `quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`,
      );
    }

    quote = byId ?? byIdempotency ?? null;
  } else {
    quote = await withQueryable(input.runtime, async (db) => {
      const [record] = await db
        .select()
        .from(fxSchema.fxQuotes)
        .where(eq(fxSchema.fxQuotes.idempotencyKey, quoteRef))
        .limit(1);
      return record ?? null;
    });
  }

  if (!quote) {
    throw new DocumentValidationError(`Quote not found: ${quoteRef}`);
  }

  return {
    quote,
    resolvedRef: quoteRef,
  };
}

async function buildQuoteSnapshotBase(input: {
  runtime: DocumentModuleRuntime;
  currenciesService: CurrenciesService;
  quote: typeof fxSchema.fxQuotes.$inferSelect;
}) {
  const { currenciesService, quote } = input;
  const [fromCurrency, toCurrency] = await Promise.all([
    currenciesService.findById(quote.fromCurrencyId),
    currenciesService.findById(quote.toCurrencyId),
  ]);
  const { legs, financialLineRows } = await withQueryable(
    input.runtime,
    async (db) => {
      const quoteLegs = await db
        .select()
        .from(fxSchema.fxQuoteLegs)
        .where(eq(fxSchema.fxQuoteLegs.quoteId, quote.id))
        .orderBy(fxSchema.fxQuoteLegs.idx);
      const quoteFinancialLineRows = await db
        .select()
        .from(fxSchema.fxQuoteFinancialLines)
        .where(eq(fxSchema.fxQuoteFinancialLines.quoteId, quote.id))
        .orderBy(fxSchema.fxQuoteFinancialLines.idx);

      return {
        legs: quoteLegs,
        financialLineRows: quoteFinancialLineRows,
      };
    },
  );
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

  return {
    quoteId: quote.id,
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
        bucket: line.bucket as FinancialLine["bucket"],
        currency: currency.code,
        amountMinor: line.amountMinor,
        source: line.source as FinancialLine["source"],
        settlementMode: line.settlementMode as FinancialLine["settlementMode"],
        memo: line.memo ?? undefined,
        metadata: line.metadata ?? undefined,
      });

      return {
        ...normalizedLine,
        amount: minorToAmountString(normalizedLine.amountMinor, {
          precision: currency.precision,
        }),
        amountMinor: normalizedLine.amountMinor.toString(),
        settlementMode: normalizedLine.settlementMode ?? "in_ledger",
      };
    }),
  };
}

async function loadQuoteSnapshotRecord(input: {
  runtime: DocumentModuleRuntime;
  currenciesService: CurrenciesService;
  quoteRef: string;
}): Promise<QuoteSnapshot> {
  const { quote, resolvedRef } = await loadQuoteRecordByRef(input);
  const snapshotWithoutHash = await buildQuoteSnapshotBase({
    runtime: input.runtime,
    currenciesService: input.currenciesService,
    quote,
  });

  return QuoteSnapshotSchema.parse({
    ...snapshotWithoutHash,
    quoteRef: resolvedRef,
    snapshotHash: buildQuoteSnapshotHash({
      ...snapshotWithoutHash,
      quoteRef: resolvedRef,
    }),
  });
}

async function markQuoteUsedForRef(input: {
  runtime: DocumentModuleRuntime;
  quoteId: string;
  usedByRef: string;
  at: Date;
  contextLabel: string;
}) {
  const { quoteId, usedByRef, at, contextLabel } = input;
  const quote = await withQueryable(input.runtime, async (db) => {
    const [record] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.id, quoteId))
      .limit(1);
    return record ?? null;
  });

  if (!quote) {
    throw new DocumentValidationError(`Quote not found: ${quoteId}`);
  }

  if (quote.status === "used" && quote.usedByRef === usedByRef) {
    return;
  }

  if (quote.status !== "active") {
    throw new DocumentValidationError(
      `Quote ${quoteId} is not active for ${contextLabel}`,
    );
  }

  if (quote.expiresAt.getTime() < at.getTime()) {
    throw new DocumentValidationError(`Quote ${quoteId} is expired`);
  }

  const updated = await withQueryable(input.runtime, async (db) => {
    const [record] = await db
      .update(fxSchema.fxQuotes)
      .set({
        status: "used",
        usedByRef,
        usedAt: at,
      })
      .where(
        and(
          eq(fxSchema.fxQuotes.id, quoteId),
          eq(fxSchema.fxQuotes.status, "active"),
        ),
      )
      .returning();
    return record ?? null;
  });

  if (updated) {
    return;
  }

  const reloaded = await withQueryable(input.runtime, async (db) => {
    const [record] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.id, quoteId))
      .limit(1);
    return record ?? null;
  });

  if (!reloaded) {
    throw new DocumentValidationError(`Quote not found: ${quoteId}`);
  }

  if (reloaded.status === "used" && reloaded.usedByRef === usedByRef) {
    return;
  }

  if (reloaded.status === "used") {
    throw new DocumentValidationError(
      `Quote ${quoteId} is already used by ${reloaded.usedByRef ?? "another document"}`,
    );
  }

  throw new DocumentValidationError(
    `Quote ${quoteId} could not be locked for ${contextLabel}`,
  );
}

export function createCommercialDocumentDeps(input: {
  currenciesService: CurrenciesService;
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
}): CommercialModuleDeps {
  const { currenciesService, requisitesService } = input;

  return {
    quoteSnapshot: {
      async loadQuoteSnapshot({ runtime, quoteRef }) {
        return loadQuoteSnapshotRecord({
          runtime,
          currenciesService,
          quoteRef,
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForInvoice({
        runtime,
        quoteId,
        invoiceDocumentId,
        at,
      }) {
        await markQuoteUsedForRef({
          runtime,
          quoteId,
          usedByRef: `invoice:${invoiceDocumentId}`,
          at,
          contextLabel: "invoice posting",
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
