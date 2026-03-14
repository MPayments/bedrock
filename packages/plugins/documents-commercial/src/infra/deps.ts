import { and, eq } from "drizzle-orm";

import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import { createDocumentsQueries } from "@bedrock/documents/queries";
import { schema as fxSchema } from "@bedrock/fx/schema";
import { DocumentValidationError, type DocumentModule } from "@bedrock/plugin-documents-sdk";
import type { CurrenciesService } from "@bedrock/currencies";
import type { RequisitesService } from "@bedrock/requisites";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/platform/crypto";
import { isUuidLike } from "@bedrock/shared/core/uuid";
import { minorToAmountString } from "@bedrock/shared/money";

import type { QuoteSnapshot } from "../validation";
import { QuoteSnapshotSchema } from "../validation";
import type { CommercialModuleDeps } from "../documents/internal/types";

type Queryable = Parameters<DocumentModule["canPost"]>[0]["db"];

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

async function loadDocumentByType(input: {
  db: Queryable;
  documentId: string;
  docType: string;
  forUpdate?: boolean;
}) {
  const document = await createDocumentsQueries({ db: input.db }).getDocumentByType({
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

async function loadQuoteRecordByRef(input: {
  db: Queryable;
  quoteRef: string;
}) {
  const { db, quoteRef } = input;
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

  return {
    quote,
    resolvedRef: quoteRef,
  };
}

async function buildQuoteSnapshotBase(input: {
  db: Queryable;
  currenciesService: CurrenciesService;
  quote: typeof fxSchema.fxQuotes.$inferSelect;
}) {
  const { db, currenciesService, quote } = input;
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
  db: Queryable;
  currenciesService: CurrenciesService;
  quoteRef: string;
}): Promise<QuoteSnapshot> {
  const { quote, resolvedRef } = await loadQuoteRecordByRef(input);
  const snapshotWithoutHash = await buildQuoteSnapshotBase({
    db: input.db,
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
  db: Queryable;
  quoteId: string;
  usedByRef: string;
  at: Date;
  contextLabel: string;
}) {
  const { db, quoteId, usedByRef, at, contextLabel } = input;
  const [quote] = await db
    .select()
    .from(fxSchema.fxQuotes)
    .where(eq(fxSchema.fxQuotes.id, quoteId))
    .limit(1);

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

  const [updated] = await db
    .update(fxSchema.fxQuotes)
    .set({
      status: "used",
      usedByRef,
      usedAt: at,
    })
    .where(
      and(eq(fxSchema.fxQuotes.id, quoteId), eq(fxSchema.fxQuotes.status, "active")),
    )
    .returning();

  if (updated) {
    return;
  }

  const [reloaded] = await db
    .select()
    .from(fxSchema.fxQuotes)
    .where(eq(fxSchema.fxQuotes.id, quoteId))
    .limit(1);

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
  requisitesService: RequisitesService;
}): CommercialModuleDeps {
  const { currenciesService, requisitesService } = input;

  return {
    quoteSnapshot: {
      async loadQuoteSnapshot({ db, quoteRef }) {
        return loadQuoteSnapshotRecord({
          db,
          currenciesService,
          quoteRef,
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForInvoice({
        db,
        quoteId,
        invoiceDocumentId,
        at,
      }) {
        await markQuoteUsedForRef({
          db,
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
      loadInvoice({ db, invoiceDocumentId, forUpdate = false }) {
        return loadDocumentByType({
          db,
          documentId: invoiceDocumentId,
          docType: INVOICE_DOC_TYPE,
          forUpdate,
        });
      },
      async getInvoiceExchangeChild({ db, invoiceDocumentId }) {
        return createDocumentsQueries({ db }).findIncomingLinkedDocument({
          toDocumentId: invoiceDocumentId,
          linkType: "parent",
          fromDocType: EXCHANGE_DOC_TYPE,
        });
      },
      async getInvoiceAcceptanceChild({ db, invoiceDocumentId }) {
        return createDocumentsQueries({ db }).findIncomingLinkedDocument({
          toDocumentId: invoiceDocumentId,
          linkType: "parent",
          fromDocType: ACCEPTANCE_DOC_TYPE,
        });
      },
      async getExchangeAcceptance({ db, exchangeDocumentId }) {
        return createDocumentsQueries({ db }).findIncomingLinkedDocument({
          toDocumentId: exchangeDocumentId,
          linkType: "depends_on",
          fromDocType: ACCEPTANCE_DOC_TYPE,
        });
      },
    },
  };
}
