import { and, asc, eq, inArray } from "drizzle-orm";

import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/commercial-documents/contracts";
import { QuoteSnapshotSchema } from "@bedrock/commercial-documents/validation";
import { type CommercialModuleDeps } from "@bedrock/commercial-documents";
import {
  DocumentValidationError,
  type DocumentModule,
} from "@bedrock/documents";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as fxSchema } from "@bedrock/fx/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import type { CurrenciesService } from "@bedrock/currencies";
import type { IfrsModuleDeps } from "@bedrock/ifrs-documents";
import type { RequisitesService } from "@bedrock/parties/requisites";
import { canonicalJson } from "@bedrock/kernel/canon";
import { sha256Hex } from "@bedrock/kernel/crypto";
import { isUuidLike } from "@bedrock/kernel/utils";
import { minorToAmountString } from "@bedrock/kernel/money";
import type { QuoteSnapshot } from "@bedrock/commercial-documents/validation";

type Queryable = Parameters<DocumentModule["canPost"]>[0]["db"];

const INVOICE_DOC_TYPE = "invoice";
const EXCHANGE_DOC_TYPE = "exchange";
const ACCEPTANCE_DOC_TYPE = "acceptance";
const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

function buildQuoteSnapshotHash(snapshot: Omit<QuoteSnapshot, "snapshotHash">) {
  return sha256Hex(canonicalJson(snapshot));
}

async function loadDocumentByType(input: {
  db: Queryable;
  documentId: string;
  docType: string;
  forUpdate?: boolean;
}) {
  const query = input.db
    .select()
    .from(documentsSchema.documents)
    .where(
      and(
        eq(documentsSchema.documents.id, input.documentId),
        eq(documentsSchema.documents.docType, input.docType),
      ),
    )
    .limit(1);
  const [document] = input.forUpdate ? await query.for("update") : await query;

  if (!document) {
    throw new DocumentValidationError(
      `Document not found: ${input.docType}/${input.documentId}`,
    );
  }

  return document;
}

export function createCommercialDocumentDeps(input: {
  currenciesService: CurrenciesService;
  requisitesService: RequisitesService;
}): CommercialModuleDeps {
  const { currenciesService, requisitesService } = input;

  return {
    quoteSnapshot: {
      async loadQuoteSnapshot({
        db,
        quoteRef,
      }: {
        db: Queryable;
        quoteRef: string;
      }): Promise<QuoteSnapshot> {
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
        const currencyById = new Map<
          string,
          { code: string; precision: number }
        >();
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
              bucket: line.bucket as FinancialLine["bucket"],
              currency: currency.code,
              amountMinor: line.amountMinor,
              source: line.source as FinancialLine["source"],
              settlementMode:
                line.settlementMode as FinancialLine["settlementMode"],
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
        } satisfies Omit<QuoteSnapshot, "snapshotHash">;

        return QuoteSnapshotSchema.parse({
          ...snapshotWithoutHash,
          snapshotHash: buildQuoteSnapshotHash(snapshotWithoutHash),
        });
      },
    },
    quoteUsage: {
      async markQuoteUsedForInvoice({
        db,
        quoteId,
        invoiceDocumentId,
        at,
      }: {
        db: Queryable;
        quoteId: string;
        invoiceDocumentId: string;
        at: Date;
      }): Promise<void> {
        const [quote] = await db
          .select()
          .from(fxSchema.fxQuotes)
          .where(eq(fxSchema.fxQuotes.id, quoteId))
          .limit(1);

        if (!quote) {
          throw new DocumentValidationError(`Quote not found: ${quoteId}`);
        }

        const expectedUsedByRef = `invoice:${invoiceDocumentId}`;
        if (quote.status === "used" && quote.usedByRef === expectedUsedByRef) {
          return;
        }

        if (quote.status !== "active") {
          throw new DocumentValidationError(
            `Quote ${quoteId} is not active for invoice posting`,
          );
        }

        if (quote.expiresAt.getTime() < at.getTime()) {
          throw new DocumentValidationError(`Quote ${quoteId} is expired`);
        }

        const [updated] = await db
          .update(fxSchema.fxQuotes)
          .set({
            status: "used",
            usedByRef: expectedUsedByRef,
            usedAt: at,
          })
          .where(
            and(
              eq(fxSchema.fxQuotes.id, quoteId),
              eq(fxSchema.fxQuotes.status, "active"),
            ),
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

        if (
          reloaded.status === "used" &&
          reloaded.usedByRef === expectedUsedByRef
        ) {
          return;
        }

        if (reloaded.status === "used") {
          throw new DocumentValidationError(
            `Quote ${quoteId} is already used by ${reloaded.usedByRef ?? "another document"}`,
          );
        }

        throw new DocumentValidationError(
          `Quote ${quoteId} could not be locked for invoice posting`,
        );
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
      async getInvoiceExchangeChild({
        db,
        invoiceDocumentId,
      }: {
        db: Queryable;
        invoiceDocumentId: string;
      }) {
        const [row] = await db
          .select({
            document: documentsSchema.documents,
          })
          .from(documentsSchema.documentLinks)
          .innerJoin(
            documentsSchema.documents,
            eq(
              documentsSchema.documents.id,
              documentsSchema.documentLinks.fromDocumentId,
            ),
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
      },
      async getInvoiceAcceptanceChild({
        db,
        invoiceDocumentId,
      }: {
        db: Queryable;
        invoiceDocumentId: string;
      }) {
        const [row] = await db
          .select({
            document: documentsSchema.documents,
          })
          .from(documentsSchema.documentLinks)
          .innerJoin(
            documentsSchema.documents,
            eq(
              documentsSchema.documents.id,
              documentsSchema.documentLinks.fromDocumentId,
            ),
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
      },
      async getExchangeAcceptance({
        db,
        exchangeDocumentId,
      }: {
        db: Queryable;
        exchangeDocumentId: string;
      }) {
        const [row] = await db
          .select({
            document: documentsSchema.documents,
          })
          .from(documentsSchema.documentLinks)
          .innerJoin(
            documentsSchema.documents,
            eq(
              documentsSchema.documents.id,
              documentsSchema.documentLinks.fromDocumentId,
            ),
          )
          .where(
            and(
              eq(
                documentsSchema.documentLinks.toDocumentId,
                exchangeDocumentId,
              ),
              eq(documentsSchema.documentLinks.linkType, "depends_on"),
              eq(documentsSchema.documents.docType, ACCEPTANCE_DOC_TYPE),
            ),
          )
          .limit(1);

        return row?.document ?? null;
      },
    },
  };
}

export function createIfrsDocumentDeps(input: {
  requisitesService: RequisitesService;
}): IfrsModuleDeps {
  const { requisitesService } = input;

  return {
    requisitesService,
    transferLookup: {
      async resolveTransferDependencyDocument({
        db,
        transferDocumentId,
      }: {
        db: Queryable;
        transferDocumentId: string;
      }) {
        const [dependency] = await db
          .select({
            document: documentsSchema.documents,
          })
          .from(documentsSchema.documents)
          .where(
            and(
              eq(documentsSchema.documents.id, transferDocumentId),
              inArray(documentsSchema.documents.docType, [
                ...TRANSFER_DOC_TYPES,
              ]),
            ),
          )
          .limit(1);

        if (!dependency) {
          throw new DocumentValidationError(
            `Transfer document ${transferDocumentId} was not found`,
          );
        }

        return dependency.document;
      },
      async listPendingTransfers({
        db,
        transferDocumentId,
      }: {
        db: Queryable;
        transferDocumentId: string;
      }) {
        return db
          .select({
            transferId: ledgerSchema.tbTransferPlans.transferId,
            pendingRef: ledgerSchema.tbTransferPlans.pendingRef,
            amountMinor: ledgerSchema.tbTransferPlans.amount,
          })
          .from(documentsSchema.documentOperations)
          .innerJoin(
            ledgerSchema.tbTransferPlans,
            eq(
              ledgerSchema.tbTransferPlans.operationId,
              documentsSchema.documentOperations.operationId,
            ),
          )
          .where(
            and(
              eq(
                documentsSchema.documentOperations.documentId,
                transferDocumentId,
              ),
              eq(documentsSchema.documentOperations.kind, "post"),
              eq(ledgerSchema.tbTransferPlans.isPending, true),
            ),
          )
          .orderBy(asc(ledgerSchema.tbTransferPlans.lineNo));
      },
    },
  };
}
