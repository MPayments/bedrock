import { and, asc, eq } from "drizzle-orm";

import type { CurrenciesService } from "@bedrock/currencies";
import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import type { FxService } from "@bedrock/fx";
import { schema as fxSchema } from "@bedrock/fx/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { sha256Hex } from "@bedrock/platform/crypto";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { DocumentValidationError, type DocumentModuleRuntime } from "@bedrock/plugin-documents-sdk";
import type { RequisitesService } from "@bedrock/requisites";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { minorToAmountString } from "@bedrock/shared/money";

import type { IfrsModuleDeps } from "../documents/internal/types";
import { FxExecuteQuoteSnapshotSchema } from "../validation";

type Queryable = Database | Transaction;

const FX_EXECUTE_DOC_TYPE = "fx_execute";
const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

async function loadQuoteRecordById(input: {
  runtime: DocumentModuleRuntime;
  quoteId: string;
}) {
  const quote = await withQueryable(input.runtime, async (db) => {
    const [record] = await db
      .select()
      .from(fxSchema.fxQuotes)
      .where(eq(fxSchema.fxQuotes.id, input.quoteId))
      .limit(1);
    return record ?? null;
  });

  if (!quote) {
    throw new DocumentValidationError(`Quote not found: ${input.quoteId}`);
  }

  return quote;
}

async function withQueryable<TResult>(
  runtime: DocumentModuleRuntime,
  run: (db: Queryable) => Promise<TResult>,
) {
  return runtime.withQueryable((queryable) => run(queryable as Queryable));
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
  const { financialLineRows, legs } = await withQueryable(
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
        financialLineRows: quoteFinancialLineRows,
        legs: quoteLegs,
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

async function loadFxExecuteQuoteSnapshotById(input: {
  runtime: DocumentModuleRuntime;
  currenciesService: CurrenciesService;
  quoteId: string;
}) {
  const quote = await loadQuoteRecordById({
    runtime: input.runtime,
    quoteId: input.quoteId,
  });
  const snapshotWithoutHash = await buildQuoteSnapshotBase({
    runtime: input.runtime,
    currenciesService: input.currenciesService,
    quote,
  });

  return FxExecuteQuoteSnapshotSchema.parse({
    ...snapshotWithoutHash,
    snapshotHash: buildQuoteSnapshotHash(snapshotWithoutHash),
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

export function createIfrsDocumentDeps(input: {
  currenciesService: CurrenciesService;
  fxService: FxService;
  requisitesService: RequisitesService;
}): IfrsModuleDeps {
  const { currenciesService, fxService, requisitesService } = input;

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

        return withQueryable(runtime, async (db) =>
          db
            .select({
              transferId: ledgerSchema.tbTransferPlans.transferId,
              pendingRef: ledgerSchema.tbTransferPlans.pendingRef,
              amountMinor: ledgerSchema.tbTransferPlans.amount,
            })
            .from(ledgerSchema.tbTransferPlans)
            .where(
              and(
                eq(ledgerSchema.tbTransferPlans.operationId, operationId),
                eq(ledgerSchema.tbTransferPlans.isPending, true),
              ),
            )
            .orderBy(asc(ledgerSchema.tbTransferPlans.lineNo)),
        );
      },
    },
    fxExecuteLookup: {
      async resolveFxExecuteDependencyDocument({ runtime, fxExecuteDocumentId }) {
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

        return withQueryable(runtime, async (db) =>
          db
            .select({
              transferId: ledgerSchema.tbTransferPlans.transferId,
              pendingRef: ledgerSchema.tbTransferPlans.pendingRef,
              amountMinor: ledgerSchema.tbTransferPlans.amount,
            })
            .from(ledgerSchema.tbTransferPlans)
            .where(
              and(
                eq(ledgerSchema.tbTransferPlans.operationId, operationId),
                eq(ledgerSchema.tbTransferPlans.isPending, true),
              ),
            )
            .orderBy(asc(ledgerSchema.tbTransferPlans.lineNo)),
        );
      },
    },
    treasuryFxQuote: {
      async createQuoteSnapshot({
        runtime,
        fromCurrency,
        toCurrency,
        fromAmountMinor,
        asOf,
        idempotencyKey,
      }) {
        const quote = await fxService.quote({
          mode: "auto_cross",
          idempotencyKey,
          fromCurrency,
          toCurrency,
          fromAmountMinor: BigInt(fromAmountMinor),
          asOf,
        });

        return loadFxExecuteQuoteSnapshotById({
          runtime,
          currenciesService,
          quoteId: quote.id,
        });
      },
      loadQuoteSnapshotById({ runtime, quoteId }) {
        return loadFxExecuteQuoteSnapshotById({
          runtime,
          currenciesService,
          quoteId,
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForFxExecute({
        runtime,
        quoteId,
        fxExecuteDocumentId,
        at,
      }) {
        await markQuoteUsedForRef({
          runtime,
          quoteId,
          usedByRef: `fx_execute:${fxExecuteDocumentId}`,
          at,
          contextLabel: "treasury FX posting",
        });
      },
    },
  };
}
