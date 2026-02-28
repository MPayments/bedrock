import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DOCUMENT_MODULE_ID, OPERATION_CODE, POSTING_TEMPLATE_KEY, } from "@bedrock/accounting-contracts";
import { schema } from "@bedrock/db/schema";
import { adjustmentEffectSchema, feeAccountingTreatmentSchema, feeDealDirectionSchema, feeDealFormSchema, feeSettlementModeSchema, } from "@bedrock/fees";
import { DocumentValidationError } from "@bedrock/documents";
import { isUuidLike } from "@bedrock/kernel";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";
import { InvalidStateError, NotFoundError } from "@bedrock/kernel/errors";
import { amountMinorSchema, buildDocumentDraft, buildDocumentPostIdempotencyKey, parseDocumentPayload, serializeOccurredAt, } from "./internal/document-utils";
import { buildDocumentPostingPlan, buildDocumentPostingRequest, } from "./internal/posting-plan";
const metadataSchema = z.record(z.string(), z.string().max(255));
const feeComponentInputSchema = z
    .object({
    id: z.string().trim().min(1).max(128).optional(),
    kind: z.string().trim().min(1).max(64),
    currency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    amountMinor: amountMinorSchema,
    settlementMode: feeSettlementModeSchema.optional(),
    accountingTreatment: feeAccountingTreatmentSchema.optional(),
    memo: z.string().max(1000).optional(),
    metadata: metadataSchema.optional(),
})
    .transform((value) => ({
    ...value,
    id: value.id ?? `manual:${value.kind}:${value.currency}:${value.amountMinor}`,
    settlementMode: value.settlementMode ?? "in_ledger",
    accountingTreatment: value.accountingTreatment ??
        (value.settlementMode === "separate_payment_order"
            ? "pass_through"
            : "income"),
    memo: value.memo ?? null,
    metadata: value.metadata ?? null,
}));
const adjustmentInputSchema = z
    .object({
    id: z.string().trim().min(1).max(128).optional(),
    kind: z.string().trim().min(1).max(64),
    effect: adjustmentEffectSchema,
    currency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    amountMinor: amountMinorSchema,
    settlementMode: feeSettlementModeSchema.optional(),
    memo: z.string().max(1000).optional(),
    metadata: metadataSchema.optional(),
})
    .transform((value) => ({
    ...value,
    id: value.id ??
        `adjustment:${value.kind}:${value.effect}:${value.currency}:${value.amountMinor}`,
    settlementMode: value.settlementMode ?? "in_ledger",
    memo: value.memo ?? null,
    metadata: value.metadata ?? null,
}));
const PaymentCaseSchema = z.object({
    customerId: z.uuid().optional(),
    subject: z.string().trim().min(1).max(255),
    memo: z.string().max(1000).optional(),
    ref: z.string().trim().max(255).optional(),
    occurredAt: z.coerce.date(),
});
const PayinFundingSchema = z.object({
    caseDocumentId: z.uuid(),
    branchCounterpartyId: z.uuid(),
    branchBankStableKey: z.string().trim().min(1).max(255),
    customerId: z.uuid(),
    payInOperationalAccountId: z.uuid(),
    currency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    amountMinor: amountMinorSchema,
    railRef: z.string().trim().min(1).max(255),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
const FxExecuteSchema = z.object({
    caseDocumentId: z.uuid(),
    payinFundingDocumentId: z.uuid(),
    branchCounterpartyId: z.uuid(),
    customerId: z.uuid(),
    payOutCounterpartyId: z.uuid(),
    payOutOperationalAccountId: z.uuid(),
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    payInCurrency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    principalMinor: amountMinorSchema,
    fees: z.array(feeComponentInputSchema).optional().default([]),
    adjustments: z.array(adjustmentInputSchema).optional().default([]),
    payOutCurrency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    payOutAmountMinor: amountMinorSchema,
    quoteRef: z.string().trim().min(1).max(255),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
const PayoutInitiateSchema = z.object({
    caseDocumentId: z.uuid(),
    fxExecuteDocumentId: z.uuid(),
    payoutCounterpartyId: z.uuid(),
    payoutBankStableKey: z.string().trim().min(1).max(255),
    payoutOperationalAccountId: z.uuid(),
    payOutCurrency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    amountMinor: amountMinorSchema,
    railRef: z.string().trim().min(1).max(255),
    timeoutSeconds: z.number().int().positive().optional(),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
const PayoutResolveSchema = z.object({
    payoutInitiateDocumentId: z.uuid(),
    payOutCurrency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    railRef: z.string().trim().min(1).max(255),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
const FeePayoutInitiateSchema = z.object({
    caseDocumentId: z.uuid(),
    fxExecuteDocumentId: z.uuid(),
    componentId: z.string().trim().min(1).max(128),
    feeBucket: z.string().trim().min(1).max(128),
    accountingTreatment: feeAccountingTreatmentSchema,
    currency: z
        .string()
        .trim()
        .min(2)
        .max(16)
        .transform((value) => value.toUpperCase()),
    amountMinor: amountMinorSchema,
    payoutCounterpartyId: z.uuid(),
    payoutOperationalAccountId: z.uuid(),
    railRef: z.string().trim().min(1).max(255),
    timeoutSeconds: z.number().int().positive().optional(),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
const FeePayoutResolveSchema = z.object({
    feePayoutInitiateDocumentId: z.uuid(),
    railRef: z.string().trim().min(1).max(255),
    memo: z.string().max(1000).optional(),
    occurredAt: z.coerce.date(),
});
function toMinor(value) {
    return typeof value === "bigint" ? value : BigInt(value);
}
function normalizePaymentCasePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
        ref: payload.ref ?? null,
        customerId: payload.customerId ?? null,
    };
}
function normalizePayinFundingPayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
    };
}
function normalizeFxExecutePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
        fees: payload.fees.map((item) => ({
            ...item,
            memo: item.memo ?? null,
            metadata: item.metadata ?? null,
        })),
        adjustments: payload.adjustments.map((item) => ({
            ...item,
            memo: item.memo ?? null,
            metadata: item.metadata ?? null,
        })),
    };
}
function normalizePayoutInitiatePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
    };
}
function normalizePayoutResolvePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
    };
}
function normalizeFeePayoutInitiatePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
    };
}
function normalizeFeePayoutResolvePayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
    };
}
function parsePaymentCasePayload(document) {
    return parseDocumentPayload(PaymentCaseSchema, document);
}
function parsePayinFundingPayload(document) {
    return parseDocumentPayload(PayinFundingSchema, document);
}
function parseFxExecutePayload(document) {
    return parseDocumentPayload(FxExecuteSchema, document);
}
function parsePayoutInitiatePayload(document) {
    return parseDocumentPayload(PayoutInitiateSchema, document);
}
function parsePayoutResolvePayload(document) {
    return parseDocumentPayload(PayoutResolveSchema, document);
}
function parseFeePayoutInitiatePayload(document) {
    return parseDocumentPayload(FeePayoutInitiateSchema, document);
}
function parseFeePayoutResolvePayload(document) {
    return parseDocumentPayload(FeePayoutResolveSchema, document);
}
function hydrateFeeComponents(payload) {
    return payload.fees.map((item) => ({
        id: item.id,
        kind: item.kind,
        currency: item.currency,
        amountMinor: toMinor(item.amountMinor),
        source: "manual",
        settlementMode: item.settlementMode,
        accountingTreatment: item.accountingTreatment,
        memo: item.memo ?? undefined,
        metadata: item.metadata ?? undefined,
    }));
}
function hydrateAdjustmentComponents(payload) {
    return payload.adjustments.map((item) => ({
        id: item.id,
        kind: item.kind,
        effect: item.effect,
        currency: item.currency,
        amountMinor: toMinor(item.amountMinor),
        source: "manual",
        settlementMode: item.settlementMode,
        memo: item.memo ?? undefined,
        metadata: item.metadata ?? undefined,
    }));
}
async function requireDocument(db, id, expectedDocType, label) {
    const [document] = await db
        .select()
        .from(schema.documents)
        .where(and(eq(schema.documents.id, id), eq(schema.documents.docType, expectedDocType)))
        .limit(1);
    if (!document) {
        throw new DocumentValidationError(`${label} not found: ${id}`);
    }
    return document;
}
async function requireParentCase(db, documentId) {
    const [row] = await db
        .select({ document: schema.documents })
        .from(schema.documentLinks)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLinks.toDocumentId))
        .where(and(eq(schema.documentLinks.fromDocumentId, documentId), eq(schema.documentLinks.linkType, "parent"), eq(schema.documents.docType, "payment_case")))
        .limit(1);
    if (!row) {
        throw new DocumentValidationError(`Parent payment_case link missing for ${documentId}`);
    }
    return row.document;
}
async function requireDependency(db, documentId, expectedDocType) {
    const [row] = await db
        .select({ document: schema.documents })
        .from(schema.documentLinks)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLinks.toDocumentId))
        .where(and(eq(schema.documentLinks.fromDocumentId, documentId), eq(schema.documentLinks.linkType, "depends_on"), eq(schema.documents.docType, expectedDocType)))
        .limit(1);
    if (!row) {
        throw new DocumentValidationError(`depends_on link to ${expectedDocType} is required for ${documentId}`);
    }
    return row.document;
}
async function ensureCaseExists(db, caseDocumentId) {
    return requireDocument(db, caseDocumentId, "payment_case", "Payment case");
}
async function ensureCounterpartyExists(db, counterpartyId) {
    const [counterparty] = await db
        .select({ id: schema.counterparties.id })
        .from(schema.counterparties)
        .where(eq(schema.counterparties.id, counterpartyId))
        .limit(1);
    if (!counterparty) {
        throw new DocumentValidationError(`Counterparty not found: ${counterpartyId}`);
    }
}
async function ensureCustomerExists(db, customerId) {
    const [customer] = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(eq(schema.customers.id, customerId))
        .limit(1);
    if (!customer) {
        throw new DocumentValidationError(`Customer not found: ${customerId}`);
    }
}
async function ensureOperationalAccountCurrency(db, currenciesService, operationalAccountId, expectedCurrency) {
    const [account] = await db
        .select({
        id: schema.operationalAccounts.id,
        currencyId: schema.operationalAccounts.currencyId,
    })
        .from(schema.operationalAccounts)
        .where(eq(schema.operationalAccounts.id, operationalAccountId))
        .for("update")
        .limit(1);
    if (!account) {
        throw new DocumentValidationError(`Operational account not found: ${operationalAccountId}`);
    }
    const currency = await currenciesService.findById(account.currencyId);
    if (currency.code !== expectedCurrency) {
        throw new DocumentValidationError(`currency mismatch for operational account ${operationalAccountId}: expected ${currency.code}, got ${expectedCurrency}`);
    }
}
function ensurePosted(document, label) {
    if (document.lifecycleStatus !== "active") {
        throw new InvalidStateError(`${label} must be active`);
    }
    if (document.postingStatus !== "posted") {
        throw new InvalidStateError(`${label} must be posted`);
    }
}
async function loadPendingTransferIdsForDocument(db, documentId) {
    const [operation] = await db
        .select({ operationId: schema.documentOperations.operationId })
        .from(schema.documentOperations)
        .where(and(eq(schema.documentOperations.documentId, documentId), eq(schema.documentOperations.kind, "post")))
        .limit(1);
    if (!operation) {
        return [];
    }
    return db
        .select({
        pendingId: schema.tbTransferPlans.transferId,
        pendingRef: schema.tbTransferPlans.pendingRef,
    })
        .from(schema.tbTransferPlans)
        .where(and(eq(schema.tbTransferPlans.operationId, operation.operationId), eq(schema.tbTransferPlans.isPending, true)));
}
async function ensureNoResolutionDocument(db, dependencyDocumentId, docTypes) {
    const rows = await db
        .select({
        docType: schema.documents.docType,
        lifecycleStatus: schema.documents.lifecycleStatus,
        postingStatus: schema.documents.postingStatus,
    })
        .from(schema.documentLinks)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLinks.fromDocumentId))
        .where(and(eq(schema.documentLinks.toDocumentId, dependencyDocumentId), eq(schema.documentLinks.linkType, "depends_on"), inArray(schema.documents.docType, docTypes)));
    const blocking = rows.find((row) => row.lifecycleStatus === "active" &&
        row.postingStatus !== "failed" &&
        row.postingStatus !== "not_required");
    if (blocking) {
        throw new DocumentValidationError(`Document ${dependencyDocumentId} already has a resolution document`);
    }
}
async function loadFxQuoteByRef(db, currenciesService, quoteRef) {
    let quote;
    if (isUuidLike(quoteRef)) {
        const [byId] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, quoteRef))
            .limit(1);
        const [byIdempotency] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
            .limit(1);
        if (byId && byIdempotency && byId.id !== byIdempotency.id) {
            throw new DocumentValidationError(`quoteRef ${quoteRef} is ambiguous between quote id and idempotency key`);
        }
        quote = byId ?? byIdempotency;
    }
    else {
        const [byIdempotency] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
            .limit(1);
        quote = byIdempotency;
    }
    if (!quote) {
        throw new NotFoundError("FX quote", quoteRef);
    }
    const [fromCurrency, toCurrency] = await Promise.all([
        currenciesService.findById(quote.fromCurrencyId),
        currenciesService.findById(quote.toCurrencyId),
    ]);
    return {
        ...quote,
        fromCurrency: fromCurrency.code,
        toCurrency: toCurrency.code,
    };
}
async function consumeFxQuoteForExecution(db, currenciesService, input) {
    const quote = await loadFxQuoteByRef(db, currenciesService, input.quoteRef);
    if (quote.fromCurrency !== input.payInCurrency) {
        throw new DocumentValidationError(`quote.fromCurrency mismatch: expected ${quote.fromCurrency}, got ${input.payInCurrency}`);
    }
    if (quote.toCurrency !== input.payOutCurrency) {
        throw new DocumentValidationError(`quote.toCurrency mismatch: expected ${quote.toCurrency}, got ${input.payOutCurrency}`);
    }
    if (quote.fromAmountMinor !== toMinor(input.principalMinor)) {
        throw new DocumentValidationError(`quote.fromAmountMinor mismatch: expected ${quote.fromAmountMinor.toString()}, got ${input.principalMinor}`);
    }
    if (quote.toAmountMinor !== toMinor(input.payOutAmountMinor)) {
        throw new DocumentValidationError(`quote.toAmountMinor mismatch: expected ${quote.toAmountMinor.toString()}, got ${input.payOutAmountMinor}`);
    }
    const usageRef = `payment_case:${input.caseDocumentId}:fx`;
    if (quote.status === "used") {
        if (quote.usedByRef === usageRef) {
            return quote;
        }
        throw new InvalidStateError(`Quote ${quote.id} is already used by ${quote.usedByRef ?? "unknown reference"}`);
    }
    if (quote.status !== "active") {
        throw new InvalidStateError(`Quote ${quote.id} is not active`);
    }
    const consumedAt = new Date();
    if (quote.expiresAt.getTime() < consumedAt.getTime()) {
        throw new InvalidStateError(`Quote ${quote.id} expired at ${quote.expiresAt.toISOString()}`);
    }
    const updated = await db
        .update(schema.fxQuotes)
        .set({
        status: "used",
        usedByRef: usageRef,
        usedAt: consumedAt,
    })
        .where(and(eq(schema.fxQuotes.id, quote.id), eq(schema.fxQuotes.status, "active")))
        .returning({
        id: schema.fxQuotes.id,
        status: schema.fxQuotes.status,
        usedByRef: schema.fxQuotes.usedByRef,
    });
    if (updated.length > 0) {
        return quote;
    }
    const [latest] = await db
        .select({
        id: schema.fxQuotes.id,
        status: schema.fxQuotes.status,
        usedByRef: schema.fxQuotes.usedByRef,
    })
        .from(schema.fxQuotes)
        .where(eq(schema.fxQuotes.id, quote.id))
        .limit(1);
    if (latest?.status === "used" && latest.usedByRef === usageRef) {
        return quote;
    }
    throw new InvalidStateError(`Quote ${quote.id} could not be consumed atomically (status=${latest?.status ?? "unknown"})`);
}
async function loadFxRouteLegs(db, currenciesService, quoteId, fallback) {
    const persistedRows = await db
        .select()
        .from(schema.fxQuoteLegs)
        .where(eq(schema.fxQuoteLegs.quoteId, quoteId))
        .limit(2048);
    const currencyIds = [
        ...new Set(persistedRows
            .flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId])
            .filter((value) => Boolean(value))),
    ];
    const codeById = new Map();
    await Promise.all(currencyIds.map(async (currencyId) => {
        const currency = await currenciesService.findById(currencyId);
        codeById.set(currencyId, currency.code);
    }));
    const routeLegs = persistedRows
        .map((leg) => ({
        ...leg,
        fromCurrency: codeById.get(leg.fromCurrencyId),
        toCurrency: codeById.get(leg.toCurrencyId),
    }))
        .sort((left, right) => left.idx - right.idx);
    if (routeLegs.length > 0) {
        return routeLegs;
    }
    return [
        {
            idx: 1,
            fromCurrency: fallback.fromCurrency,
            toCurrency: fallback.toCurrency,
            fromAmountMinor: fallback.fromAmountMinor,
            toAmountMinor: fallback.toAmountMinor,
            rateNum: fallback.rateNum,
            rateDen: fallback.rateDen,
            sourceKind: "derived",
            sourceRef: null,
            asOf: fallback.occurredAt,
            executionCounterpartyId: null,
            createdAt: fallback.occurredAt,
            id: quoteId,
            quoteId,
        },
    ];
}
async function buildFxExecutionArtifacts(params) {
    const { context, document, payload, feesService, currenciesService, consumeQuote, } = params;
    const caseDocument = await requireParentCase(context.db, document.id);
    const payinDocument = await requireDependency(context.db, document.id, "payin_funding");
    ensurePosted(payinDocument, "payin_funding");
    const payinPayload = parsePayinFundingPayload(payinDocument);
    if (payinPayload.caseDocumentId !== payload.caseDocumentId) {
        throw new DocumentValidationError("payin_funding case does not match fx_execute");
    }
    if (payinPayload.customerId !== payload.customerId) {
        throw new DocumentValidationError("customerId does not match payin_funding");
    }
    if (payinPayload.currency !== payload.payInCurrency) {
        throw new DocumentValidationError("payInCurrency does not match payin_funding");
    }
    if (payinPayload.amountMinor !== payload.principalMinor) {
        throw new DocumentValidationError("principalMinor does not match payin_funding");
    }
    const quote = consumeQuote
        ? await consumeFxQuoteForExecution(context.db, currenciesService, payload)
        : await loadFxQuoteByRef(context.db, currenciesService, payload.quoteRef);
    const routeLegs = await loadFxRouteLegs(context.db, currenciesService, quote.id, {
        fromCurrency: quote.fromCurrency,
        toCurrency: quote.toCurrency,
        fromAmountMinor: quote.fromAmountMinor,
        toAmountMinor: quote.toAmountMinor,
        rateNum: quote.rateNum,
        rateDen: quote.rateDen,
        occurredAt: payload.occurredAt,
    });
    if (routeLegs[0].fromCurrency !== payload.payInCurrency) {
        throw new DocumentValidationError("FX route payInCurrency mismatch");
    }
    if (routeLegs[routeLegs.length - 1].toCurrency !== payload.payOutCurrency) {
        throw new DocumentValidationError("FX route payOutCurrency mismatch");
    }
    if (routeLegs[0].fromAmountMinor !== toMinor(payload.principalMinor)) {
        throw new DocumentValidationError("FX route principal mismatch");
    }
    if (routeLegs[routeLegs.length - 1].toAmountMinor !==
        toMinor(payload.payOutAmountMinor)) {
        throw new DocumentValidationError("FX route payout amount mismatch");
    }
    const chain = `fx:${payload.quoteRef}`;
    const orderId = caseDocument.id;
    const requests = [];
    const separateFeeComponents = [];
    requests.push(buildDocumentPostingRequest(document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        currency: payload.payInCurrency,
        amountMinor: toMinor(payload.principalMinor),
        dimensions: {
            customerId: payload.customerId,
            orderId,
        },
        refs: {
            quoteRef: payload.quoteRef,
            chainId: chain,
        },
        memo: "FX principal",
    }));
    for (const leg of routeLegs) {
        const executionCounterpartyId = leg.executionCounterpartyId ?? payload.branchCounterpartyId;
        requests.push(buildDocumentPostingRequest(document, {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_OUT,
            currency: leg.fromCurrency,
            amountMinor: leg.fromAmountMinor,
            dimensions: {
                orderId,
                counterpartyId: executionCounterpartyId,
            },
            refs: {
                quoteRef: payload.quoteRef,
                chainId: chain,
                legIndex: String(leg.idx),
            },
            memo: `FX leg ${leg.idx} out`,
        }));
        requests.push(buildDocumentPostingRequest(document, {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_IN,
            currency: leg.toCurrency,
            amountMinor: leg.toAmountMinor,
            dimensions: {
                orderId,
                counterpartyId: executionCounterpartyId,
            },
            refs: {
                quoteRef: payload.quoteRef,
                chainId: chain,
                legIndex: String(leg.idx),
            },
            memo: `FX leg ${leg.idx} in`,
        }));
    }
    const quoteFeeComponents = await feesService.getQuoteFeeComponents({ quoteId: quote.id }, context.db);
    const mergedFeeComponents = feesService.mergeFeeComponents({
        computed: quoteFeeComponents,
        manual: hydrateFeeComponents(payload),
    });
    for (const [index, component] of mergedFeeComponents.entries()) {
        const defaults = feesService.getComponentDefaults(component.kind);
        const accountingTreatment = component.accountingTreatment ??
            (component.settlementMode === "separate_payment_order"
                ? "pass_through"
                : "income");
        const componentRefs = {
            quoteRef: payload.quoteRef,
            chainId: chain,
            componentId: component.id,
            componentIndex: String(index + 1),
        };
        const componentFeeBucket = component.kind === "fx_spread" ? "spread" : defaults.bucket;
        if (accountingTreatment === "income") {
            requests.push(buildDocumentPostingRequest(document, {
                templateKey: component.kind === "fx_spread"
                    ? POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME
                    : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
                currency: component.currency,
                amountMinor: component.amountMinor,
                dimensions: {
                    customerId: payload.customerId,
                    orderId,
                    feeBucket: componentFeeBucket,
                },
                refs: componentRefs,
                memo: component.memo ?? defaults.memo,
            }));
            continue;
        }
        if (accountingTreatment === "pass_through") {
            requests.push(buildDocumentPostingRequest(document, {
                templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
                currency: component.currency,
                amountMinor: component.amountMinor,
                dimensions: {
                    customerId: payload.customerId,
                    orderId,
                    feeBucket: defaults.bucket,
                },
                refs: componentRefs,
                memo: component.memo ?? "Fee reserved for separate payment order",
            }));
            separateFeeComponents.push({
                componentId: component.id,
                kind: component.kind,
                bucket: defaults.bucket,
                accountingTreatment,
                currency: component.currency,
                amountMinor: component.amountMinor,
                memo: component.memo ?? null,
                metadata: component.metadata ?? null,
                payoutOperationalAccountId: payload.payOutOperationalAccountId,
            });
            continue;
        }
        requests.push(buildDocumentPostingRequest(document, {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE,
            currency: component.currency,
            amountMinor: component.amountMinor,
            dimensions: {
                feeBucket: defaults.bucket,
                orderId,
                counterpartyId: payload.branchCounterpartyId,
            },
            refs: componentRefs,
            memo: component.memo ?? "Provider fee expense accrual",
        }));
        separateFeeComponents.push({
            componentId: component.id,
            kind: component.kind,
            bucket: defaults.bucket,
            accountingTreatment,
            currency: component.currency,
            amountMinor: component.amountMinor,
            memo: component.memo ?? null,
            metadata: component.metadata ?? null,
            payoutOperationalAccountId: payload.payOutOperationalAccountId,
        });
    }
    const mergedAdjustments = feesService.mergeAdjustmentComponents({
        manual: hydrateAdjustmentComponents(payload),
    });
    const partitionedAdjustments = feesService.partitionAdjustmentComponents(mergedAdjustments);
    for (const [index, component] of partitionedAdjustments.inLedger.entries()) {
        const feeBucket = `adjustment:${component.kind}`;
        requests.push(buildDocumentPostingRequest(document, {
            templateKey: component.effect === "increase_charge"
                ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE
                : POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
            currency: component.currency,
            amountMinor: component.amountMinor,
            dimensions: {
                customerId: payload.customerId,
                orderId,
                feeBucket,
            },
            refs: {
                quoteRef: payload.quoteRef,
                chainId: chain,
                componentId: component.id,
                componentIndex: String(index + 1),
            },
            memo: component.memo ??
                (component.effect === "increase_charge"
                    ? "Adjustment charge"
                    : "Adjustment refund"),
        }));
    }
    for (const [index, component,] of partitionedAdjustments.separatePaymentOrder.entries()) {
        const bucket = `adjustment:${component.kind}`;
        requests.push(buildDocumentPostingRequest(document, {
            templateKey: component.effect === "increase_charge"
                ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_RESERVE
                : POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE,
            currency: component.currency,
            amountMinor: component.amountMinor,
            dimensions: component.effect === "increase_charge"
                ? {
                    customerId: payload.customerId,
                    orderId,
                    feeBucket: bucket,
                }
                : {
                    orderId,
                    feeBucket: bucket,
                },
            refs: {
                quoteRef: payload.quoteRef,
                chainId: chain,
                componentId: component.id,
                componentIndex: String(index + 1),
            },
            memo: component.memo ?? "Adjustment reserved for separate payment order",
        }));
        separateFeeComponents.push({
            componentId: component.id,
            kind: `adjustment:${component.kind}`,
            bucket,
            accountingTreatment: "pass_through",
            currency: component.currency,
            amountMinor: component.amountMinor,
            memo: component.memo ?? null,
            metadata: component.metadata ?? null,
            payoutOperationalAccountId: payload.payOutOperationalAccountId,
        });
    }
    requests.push(buildDocumentPostingRequest(document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
        currency: payload.payOutCurrency,
        amountMinor: toMinor(payload.payOutAmountMinor),
        dimensions: {
            orderId,
        },
        refs: {
            quoteRef: payload.quoteRef,
            chainId: chain,
            payoutCounterpartyId: payload.payOutCounterpartyId,
        },
        memo: "Create payout obligation",
    }));
    return {
        quoteId: quote.id,
        requests,
        separateFeeComponents,
    };
}
async function buildPaymentCaseComputed(context, document) {
    const children = await context.db
        .select({
        id: schema.documents.id,
        docNo: schema.documents.docNo,
        docType: schema.documents.docType,
        title: schema.documents.title,
        occurredAt: schema.documents.occurredAt,
        submissionStatus: schema.documents.submissionStatus,
        approvalStatus: schema.documents.approvalStatus,
        postingStatus: schema.documents.postingStatus,
        lifecycleStatus: schema.documents.lifecycleStatus,
    })
        .from(schema.documentLinks)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLinks.fromDocumentId))
        .where(and(eq(schema.documentLinks.toDocumentId, document.id), eq(schema.documentLinks.linkType, "parent")));
    const childIds = children.map((item) => item.id);
    const dependencyRows = childIds.length > 0
        ? await context.db
            .select({
            fromDocumentId: schema.documentLinks.fromDocumentId,
            toDocumentId: schema.documentLinks.toDocumentId,
        })
            .from(schema.documentLinks)
            .where(and(inArray(schema.documentLinks.fromDocumentId, childIds), eq(schema.documentLinks.linkType, "depends_on")))
        : [];
    const dependsOnByChild = new Map();
    for (const row of dependencyRows) {
        const current = dependsOnByChild.get(row.fromDocumentId) ?? [];
        current.push(row.toDocumentId);
        dependsOnByChild.set(row.fromDocumentId, current);
    }
    const timeline = [...children]
        .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() ||
        left.docNo.localeCompare(right.docNo))
        .map((item) => ({
        ...item,
        dependsOnDocumentIds: dependsOnByChild.get(item.id) ?? [],
    }));
    const postedTypes = new Set(timeline
        .filter((item) => item.postingStatus === "posted" ||
        item.postingStatus === "not_required")
        .map((item) => item.docType));
    const nextDocTypes = [];
    if (!postedTypes.has("payin_funding")) {
        nextDocTypes.push("payin_funding");
    }
    else if (!postedTypes.has("fx_execute")) {
        nextDocTypes.push("fx_execute");
    }
    else if (!postedTypes.has("payout_initiate")) {
        nextDocTypes.push("payout_initiate");
    }
    else if (!postedTypes.has("payout_settle") &&
        !postedTypes.has("payout_void")) {
        nextDocTypes.push("payout_settle", "payout_void");
    }
    return {
        timeline,
        nextDocTypes,
    };
}
export function createPaymentCaseDocumentModule() {
    return {
        moduleId: DOCUMENT_MODULE_ID.PAYMENT_CASE,
        docType: "payment_case",
        docNoPrefix: "PAY",
        payloadVersion: 1,
        createSchema: PaymentCaseSchema,
        updateSchema: PaymentCaseSchema,
        payloadSchema: PaymentCaseSchema.transform(normalizePaymentCasePayload),
        postingRequired: false,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizePaymentCasePayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizePaymentCasePayload(input));
        },
        deriveSummary(document) {
            const payload = parsePaymentCasePayload(document);
            return {
                title: payload.subject,
                memo: payload.memo ?? null,
                customerId: payload.customerId ?? null,
                searchText: [
                    document.docNo,
                    payload.subject,
                    payload.memo ?? "",
                    payload.ref ?? "",
                    payload.customerId ?? "",
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate(context, input) {
            if (input.customerId) {
                await ensureCustomerExists(context.db, input.customerId);
            }
        },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canPost() { },
        async canCancel() { },
        async buildDetails(context, document) {
            return {
                computed: await buildPaymentCaseComputed(context, document),
            };
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
export function createPayinFundingDocumentModule(deps) {
    return {
        moduleId: DOCUMENT_MODULE_ID.PAYIN_FUNDING,
        docType: "payin_funding",
        docNoPrefix: "PIF",
        payloadVersion: 1,
        createSchema: PayinFundingSchema,
        updateSchema: PayinFundingSchema,
        payloadSchema: PayinFundingSchema.transform(normalizePayinFundingPayload),
        postingRequired: true,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizePayinFundingPayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizePayinFundingPayload(input));
        },
        deriveSummary(document) {
            const payload = parsePayinFundingPayload(document);
            return {
                title: `Pay-in funding ${payload.currency}`,
                amountMinor: toMinor(payload.amountMinor),
                currency: payload.currency,
                memo: payload.memo ?? null,
                customerId: payload.customerId,
                counterpartyId: payload.branchCounterpartyId,
                operationalAccountId: payload.payInOperationalAccountId,
                searchText: [
                    document.docNo,
                    payload.currency,
                    payload.railRef,
                    payload.branchBankStableKey,
                    payload.memo ?? "",
                    payload.customerId,
                    payload.branchCounterpartyId,
                    payload.payInOperationalAccountId,
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate(context, input) {
            await ensureCaseExists(context.db, input.caseDocumentId);
            await Promise.all([
                ensureCustomerExists(context.db, input.customerId),
                ensureCounterpartyExists(context.db, input.branchCounterpartyId),
            ]);
        },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canCancel() { },
        async canPost(context, document) {
            const payload = parsePayinFundingPayload(document);
            const caseDocument = await requireParentCase(context.db, document.id);
            const casePayload = parsePaymentCasePayload(caseDocument);
            if (caseDocument.id !== payload.caseDocumentId) {
                throw new DocumentValidationError("Payment case link does not match payload");
            }
            if (casePayload.customerId &&
                casePayload.customerId !== payload.customerId) {
                throw new DocumentValidationError("customerId does not match payment_case");
            }
            await Promise.all([
                ensureCustomerExists(context.db, payload.customerId),
                ensureCounterpartyExists(context.db, payload.branchCounterpartyId),
                ensureOperationalAccountCurrency(context.db, deps.currenciesService, payload.payInOperationalAccountId, payload.currency),
            ]);
        },
        async buildPostingPlan(_context, document) {
            const payload = parsePayinFundingPayload(document);
            return buildDocumentPostingPlan({
                operationCode: OPERATION_CODE.TREASURY_FUNDING_SETTLED,
                payload: {
                    paymentCaseId: payload.caseDocumentId,
                    railRef: payload.railRef,
                    amountMinor: payload.amountMinor,
                    currency: payload.currency,
                    branchCounterpartyId: payload.branchCounterpartyId,
                    branchBankStableKey: payload.branchBankStableKey,
                    customerId: payload.customerId,
                    payInOperationalAccountId: payload.payInOperationalAccountId,
                    memo: payload.memo ?? null,
                },
                requests: [
                    buildDocumentPostingRequest(document, {
                        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYIN_FUNDING,
                        currency: payload.currency,
                        amountMinor: toMinor(payload.amountMinor),
                        dimensions: {
                            operationalAccountId: payload.payInOperationalAccountId,
                            customerId: payload.customerId,
                        },
                        refs: {
                            paymentCaseId: payload.caseDocumentId,
                            railRef: payload.railRef,
                            branchBankStableKey: payload.branchBankStableKey,
                            branchCounterpartyId: payload.branchCounterpartyId,
                        },
                        memo: payload.memo ?? "Funding settled",
                    }),
                ],
            });
        },
        async buildInitialLinks(_context, document) {
            const payload = parsePayinFundingPayload(document);
            return [{ toDocumentId: payload.caseDocumentId, linkType: "parent" }];
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
export function createFxExecuteDocumentModule(deps) {
    return {
        moduleId: DOCUMENT_MODULE_ID.FX_EXECUTE,
        docType: "fx_execute",
        docNoPrefix: "PFX",
        payloadVersion: 1,
        createSchema: FxExecuteSchema,
        updateSchema: FxExecuteSchema,
        payloadSchema: FxExecuteSchema.transform(normalizeFxExecutePayload),
        postingRequired: true,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizeFxExecutePayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizeFxExecutePayload(input));
        },
        deriveSummary(document) {
            const payload = parseFxExecutePayload(document);
            return {
                title: `FX ${payload.payInCurrency}/${payload.payOutCurrency}`,
                amountMinor: toMinor(payload.principalMinor),
                currency: payload.payInCurrency,
                memo: payload.memo ?? null,
                customerId: payload.customerId,
                counterpartyId: payload.branchCounterpartyId,
                operationalAccountId: payload.payOutOperationalAccountId,
                searchText: [
                    document.docNo,
                    payload.quoteRef,
                    payload.payInCurrency,
                    payload.payOutCurrency,
                    payload.memo ?? "",
                    payload.customerId,
                    payload.branchCounterpartyId,
                    payload.payOutCounterpartyId,
                    payload.payOutOperationalAccountId,
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate(context, input) {
            await Promise.all([
                ensureCaseExists(context.db, input.caseDocumentId),
                requireDocument(context.db, input.payinFundingDocumentId, "payin_funding", "payin_funding"),
                ensureCustomerExists(context.db, input.customerId),
                ensureCounterpartyExists(context.db, input.branchCounterpartyId),
                ensureCounterpartyExists(context.db, input.payOutCounterpartyId),
            ]);
        },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canCancel() { },
        async canPost(context, document) {
            const payload = parseFxExecutePayload(document);
            const payinDocument = await requireDependency(context.db, document.id, "payin_funding");
            const caseDocument = await requireParentCase(context.db, document.id);
            ensurePosted(payinDocument, "payin_funding");
            if (caseDocument.id !== payload.caseDocumentId) {
                throw new DocumentValidationError("payment_case link does not match fx_execute payload");
            }
            await Promise.all([
                ensureCustomerExists(context.db, payload.customerId),
                ensureCounterpartyExists(context.db, payload.branchCounterpartyId),
                ensureCounterpartyExists(context.db, payload.payOutCounterpartyId),
                ensureOperationalAccountCurrency(context.db, deps.currenciesService, payload.payOutOperationalAccountId, payload.payOutCurrency),
            ]);
            const payinPayload = parsePayinFundingPayload(payinDocument);
            if (payinPayload.caseDocumentId !== payload.caseDocumentId) {
                throw new DocumentValidationError("payin_funding case does not match fx_execute");
            }
            if (payinPayload.customerId !== payload.customerId) {
                throw new DocumentValidationError("customerId does not match payin_funding");
            }
            if (payinPayload.currency !== payload.payInCurrency) {
                throw new DocumentValidationError("payInCurrency does not match payin_funding");
            }
            if (payinPayload.amountMinor !== payload.principalMinor) {
                throw new DocumentValidationError("principalMinor does not match payin_funding");
            }
        },
        async buildPostingPlan(context, document) {
            const payload = parseFxExecutePayload(document);
            const artifacts = await buildFxExecutionArtifacts({
                context,
                document,
                payload,
                feesService: deps.feesService,
                currenciesService: deps.currenciesService,
                consumeQuote: true,
            });
            return buildDocumentPostingPlan({
                operationCode: OPERATION_CODE.TREASURY_FX_EXECUTED,
                payload: {
                    paymentCaseId: payload.caseDocumentId,
                    quoteId: artifacts.quoteId,
                    quoteRef: payload.quoteRef,
                    principalMinor: payload.principalMinor,
                    payOutAmountMinor: payload.payOutAmountMinor,
                    payInCurrency: payload.payInCurrency,
                    payOutCurrency: payload.payOutCurrency,
                    payOutCounterpartyId: payload.payOutCounterpartyId,
                    payOutOperationalAccountId: payload.payOutOperationalAccountId,
                    memo: payload.memo ?? null,
                },
                requests: artifacts.requests,
            });
        },
        async buildInitialLinks(_context, document) {
            const payload = parseFxExecutePayload(document);
            return [
                { toDocumentId: payload.caseDocumentId, linkType: "parent" },
                {
                    toDocumentId: payload.payinFundingDocumentId,
                    linkType: "depends_on",
                },
            ];
        },
        async buildDetails(context, document) {
            const payload = parseFxExecutePayload(document);
            const artifacts = await buildFxExecutionArtifacts({
                context,
                document,
                payload,
                feesService: deps.feesService,
                currenciesService: deps.currenciesService,
                consumeQuote: false,
            });
            return {
                computed: {
                    separateFeeComponents: artifacts.separateFeeComponents.map((item) => ({
                        ...item,
                        amountMinor: item.amountMinor.toString(),
                    })),
                },
            };
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
function createPayoutResolveModule(params) {
    return function createModule() {
        return {
            moduleId: params.moduleId,
            docType: params.docType,
            docNoPrefix: params.docNoPrefix,
            payloadVersion: 1,
            createSchema: PayoutResolveSchema,
            updateSchema: PayoutResolveSchema,
            payloadSchema: PayoutResolveSchema.transform(normalizePayoutResolvePayload),
            postingRequired: true,
            approvalRequired() {
                return false;
            },
            async createDraft(_context, input) {
                return buildDocumentDraft(input, normalizePayoutResolvePayload(input));
            },
            async updateDraft(_context, _document, input) {
                return buildDocumentDraft(input, normalizePayoutResolvePayload(input));
            },
            deriveSummary(document) {
                const payload = parsePayoutResolvePayload(document);
                return {
                    title: params.eventType === "settle" ? "Payout settled" : "Payout voided",
                    currency: payload.payOutCurrency,
                    memo: payload.memo ?? null,
                    searchText: [
                        document.docNo,
                        payload.payOutCurrency,
                        payload.railRef,
                        payload.payoutInitiateDocumentId,
                        payload.memo ?? "",
                    ]
                        .filter(Boolean)
                        .join(" "),
                };
            },
            async canCreate(context, input) {
                await requireDocument(context.db, input.payoutInitiateDocumentId, "payout_initiate", "payout_initiate");
            },
            async canEdit() { },
            async canSubmit() { },
            async canApprove() { },
            async canReject() { },
            async canCancel() { },
            async canPost(context, document) {
                const payload = parsePayoutResolvePayload(document);
                const dependency = await requireDependency(context.db, document.id, "payout_initiate");
                ensurePosted(dependency, "payout_initiate");
                const dependencyPayload = parsePayoutInitiatePayload(dependency);
                if (dependency.id !== payload.payoutInitiateDocumentId) {
                    throw new DocumentValidationError("payoutInitiateDocumentId does not match dependency");
                }
                if (dependencyPayload.payOutCurrency !== payload.payOutCurrency) {
                    throw new DocumentValidationError("payOutCurrency does not match payout_initiate");
                }
                await ensureNoResolutionDocument(context.db, dependency.id, [
                    "payout_settle",
                    "payout_void",
                ]);
            },
            async buildPostingPlan(context, document) {
                const payload = parsePayoutResolvePayload(document);
                const dependency = await requireDependency(context.db, document.id, "payout_initiate");
                const pendingTransferIds = await loadPendingTransferIdsForDocument(context.db, dependency.id);
                const pendingTransferId = pendingTransferIds[0]?.pendingId;
                if (!pendingTransferId) {
                    throw new InvalidStateError("Missing payout pending transfer id");
                }
                return buildDocumentPostingPlan({
                    operationCode: params.eventType === "settle"
                        ? OPERATION_CODE.TREASURY_PAYOUT_SETTLE
                        : OPERATION_CODE.TREASURY_PAYOUT_VOID,
                    payload: {
                        payoutInitiateDocumentId: payload.payoutInitiateDocumentId,
                        railRef: payload.railRef,
                        pendingTransferId: pendingTransferId.toString(),
                        payOutCurrency: payload.payOutCurrency,
                        memo: payload.memo ?? null,
                    },
                    requests: [
                        buildDocumentPostingRequest(document, {
                            templateKey: params.eventType === "settle"
                                ? POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE
                                : POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
                            currency: payload.payOutCurrency,
                            amountMinor: 0n,
                            dimensions: {},
                            refs: {
                                railRef: payload.railRef,
                                orderId: (await requireParentCase(context.db, dependency.id))
                                    .id,
                            },
                            pending: {
                                pendingId: pendingTransferId,
                                amountMinor: 0n,
                            },
                            memo: payload.memo ?? null,
                        }),
                    ],
                });
            },
            async buildInitialLinks(context, document) {
                const payload = parsePayoutResolvePayload(document);
                const dependency = await requireDocument(context.db, payload.payoutInitiateDocumentId, "payout_initiate", "payout_initiate");
                const parentCase = await requireParentCase(context.db, dependency.id);
                return [
                    { toDocumentId: parentCase.id, linkType: "parent" },
                    { toDocumentId: dependency.id, linkType: "depends_on" },
                ];
            },
            buildPostIdempotencyKey(document) {
                return buildDocumentPostIdempotencyKey(document);
            },
        };
    };
}
export function createPayoutInitiateDocumentModule(deps) {
    return {
        moduleId: DOCUMENT_MODULE_ID.PAYOUT_INITIATE,
        docType: "payout_initiate",
        docNoPrefix: "POT",
        payloadVersion: 1,
        createSchema: PayoutInitiateSchema,
        updateSchema: PayoutInitiateSchema,
        payloadSchema: PayoutInitiateSchema.transform(normalizePayoutInitiatePayload),
        postingRequired: true,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizePayoutInitiatePayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizePayoutInitiatePayload(input));
        },
        deriveSummary(document) {
            const payload = parsePayoutInitiatePayload(document);
            return {
                title: `Payout initiate ${payload.payOutCurrency}`,
                amountMinor: toMinor(payload.amountMinor),
                currency: payload.payOutCurrency,
                memo: payload.memo ?? null,
                counterpartyId: payload.payoutCounterpartyId,
                operationalAccountId: payload.payoutOperationalAccountId,
                searchText: [
                    document.docNo,
                    payload.payOutCurrency,
                    payload.railRef,
                    payload.payoutBankStableKey,
                    payload.payoutCounterpartyId,
                    payload.payoutOperationalAccountId,
                    payload.memo ?? "",
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate(context, input) {
            await Promise.all([
                ensureCaseExists(context.db, input.caseDocumentId),
                requireDocument(context.db, input.fxExecuteDocumentId, "fx_execute", "fx_execute"),
                ensureCounterpartyExists(context.db, input.payoutCounterpartyId),
            ]);
        },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canCancel() { },
        async canPost(context, document) {
            const payload = parsePayoutInitiatePayload(document);
            const fxDocument = await requireDependency(context.db, document.id, "fx_execute");
            const caseDocument = await requireParentCase(context.db, document.id);
            ensurePosted(fxDocument, "fx_execute");
            if (caseDocument.id !== payload.caseDocumentId) {
                throw new DocumentValidationError("payment_case link does not match payout_initiate payload");
            }
            const fxPayload = parseFxExecutePayload(fxDocument);
            if (fxPayload.caseDocumentId !== payload.caseDocumentId) {
                throw new DocumentValidationError("fx_execute case does not match payout");
            }
            if (fxPayload.payOutCounterpartyId !== payload.payoutCounterpartyId) {
                throw new DocumentValidationError("payoutCounterpartyId does not match fx_execute");
            }
            if (fxPayload.payOutOperationalAccountId !==
                payload.payoutOperationalAccountId) {
                throw new DocumentValidationError("payoutOperationalAccountId does not match fx_execute");
            }
            if (fxPayload.payOutCurrency !== payload.payOutCurrency) {
                throw new DocumentValidationError("payOutCurrency does not match fx_execute");
            }
            if (fxPayload.payOutAmountMinor !== payload.amountMinor) {
                throw new DocumentValidationError("amountMinor does not match fx_execute");
            }
            await Promise.all([
                ensureCounterpartyExists(context.db, payload.payoutCounterpartyId),
                ensureOperationalAccountCurrency(context.db, deps.currenciesService, payload.payoutOperationalAccountId, payload.payOutCurrency),
            ]);
        },
        async buildPostingPlan(context, document) {
            const payload = parsePayoutInitiatePayload(document);
            const timeoutSeconds = payload.timeoutSeconds ?? DAY_IN_SECONDS;
            return buildDocumentPostingPlan({
                operationCode: OPERATION_CODE.TREASURY_PAYOUT_INIT,
                payload: {
                    paymentCaseId: payload.caseDocumentId,
                    railRef: payload.railRef,
                    amountMinor: payload.amountMinor,
                    payOutCurrency: payload.payOutCurrency,
                    payoutCounterpartyId: payload.payoutCounterpartyId,
                    payoutOperationalAccountId: payload.payoutOperationalAccountId,
                    memo: payload.memo ?? null,
                },
                requests: [
                    buildDocumentPostingRequest(document, {
                        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_INITIATE,
                        currency: payload.payOutCurrency,
                        amountMinor: toMinor(payload.amountMinor),
                        dimensions: {
                            orderId: payload.caseDocumentId,
                            operationalAccountId: payload.payoutOperationalAccountId,
                        },
                        refs: {
                            railRef: payload.railRef,
                            payoutBankStableKey: payload.payoutBankStableKey,
                        },
                        pending: {
                            timeoutSeconds,
                            ref: `payout:${payload.caseDocumentId}:init`,
                        },
                        memo: payload.memo ?? "Payout initiated (pending)",
                    }),
                ],
            });
        },
        async buildInitialLinks(_context, document) {
            const payload = parsePayoutInitiatePayload(document);
            return [
                { toDocumentId: payload.caseDocumentId, linkType: "parent" },
                { toDocumentId: payload.fxExecuteDocumentId, linkType: "depends_on" },
            ];
        },
        async buildDetails(context, document) {
            const pendingTransferIds = await loadPendingTransferIdsForDocument(context.db, document.id);
            return {
                computed: { pendingTransferIds },
            };
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
export function createPayoutSettleDocumentModule() {
    return createPayoutResolveModule({
        moduleId: DOCUMENT_MODULE_ID.PAYOUT_SETTLE,
        docType: "payout_settle",
        docNoPrefix: "PST",
        eventType: "settle",
    })();
}
export function createPayoutVoidDocumentModule() {
    return createPayoutResolveModule({
        moduleId: DOCUMENT_MODULE_ID.PAYOUT_VOID,
        docType: "payout_void",
        docNoPrefix: "PVD",
        eventType: "void",
    })();
}
function createFeePayoutResolveModule(params) {
    return function createModule() {
        return {
            moduleId: params.moduleId,
            docType: params.docType,
            docNoPrefix: params.docNoPrefix,
            payloadVersion: 1,
            createSchema: FeePayoutResolveSchema,
            updateSchema: FeePayoutResolveSchema,
            payloadSchema: FeePayoutResolveSchema.transform(normalizeFeePayoutResolvePayload),
            postingRequired: true,
            approvalRequired() {
                return false;
            },
            async createDraft(_context, input) {
                return buildDocumentDraft(input, normalizeFeePayoutResolvePayload(input));
            },
            async updateDraft(_context, _document, input) {
                return buildDocumentDraft(input, normalizeFeePayoutResolvePayload(input));
            },
            deriveSummary(document) {
                const payload = parseFeePayoutResolvePayload(document);
                return {
                    title: params.eventType === "settle"
                        ? "Fee payout settled"
                        : "Fee payout voided",
                    memo: payload.memo ?? null,
                    searchText: [
                        document.docNo,
                        payload.feePayoutInitiateDocumentId,
                        payload.railRef,
                        payload.memo ?? "",
                    ]
                        .filter(Boolean)
                        .join(" "),
                };
            },
            async canCreate(context, input) {
                await requireDocument(context.db, input.feePayoutInitiateDocumentId, "fee_payout_initiate", "fee_payout_initiate");
            },
            async canEdit() { },
            async canSubmit() { },
            async canApprove() { },
            async canReject() { },
            async canCancel() { },
            async canPost(context, document) {
                const payload = parseFeePayoutResolvePayload(document);
                const dependency = await requireDependency(context.db, document.id, "fee_payout_initiate");
                ensurePosted(dependency, "fee_payout_initiate");
                if (dependency.id !== payload.feePayoutInitiateDocumentId) {
                    throw new DocumentValidationError("feePayoutInitiateDocumentId does not match dependency");
                }
                await ensureNoResolutionDocument(context.db, dependency.id, [
                    "fee_payout_settle",
                    "fee_payout_void",
                ]);
            },
            async buildPostingPlan(context, document) {
                const payload = parseFeePayoutResolvePayload(document);
                const dependency = await requireDependency(context.db, document.id, "fee_payout_initiate");
                const dependencyPayload = parseFeePayoutInitiatePayload(dependency);
                const pendingTransferIds = await loadPendingTransferIdsForDocument(context.db, dependency.id);
                const pendingTransferId = pendingTransferIds[0]?.pendingId;
                if (!pendingTransferId) {
                    throw new InvalidStateError("Missing fee payout pending transfer id");
                }
                return buildDocumentPostingPlan({
                    operationCode: params.eventType === "settle"
                        ? OPERATION_CODE.TREASURY_FEE_PAYMENT_SETTLE
                        : OPERATION_CODE.TREASURY_FEE_PAYMENT_VOID,
                    payload: {
                        feePayoutInitiateDocumentId: payload.feePayoutInitiateDocumentId,
                        railRef: payload.railRef,
                        pendingTransferId: pendingTransferId.toString(),
                        currency: dependencyPayload.currency,
                        memo: payload.memo ?? null,
                    },
                    requests: [
                        buildDocumentPostingRequest(document, {
                            templateKey: params.eventType === "settle"
                                ? POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_SETTLE
                                : POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_VOID,
                            currency: dependencyPayload.currency,
                            amountMinor: 0n,
                            dimensions: {},
                            refs: {
                                feePayoutInitiateDocumentId: payload.feePayoutInitiateDocumentId,
                                railRef: payload.railRef,
                            },
                            pending: {
                                pendingId: pendingTransferId,
                                amountMinor: 0n,
                            },
                            memo: payload.memo ?? null,
                        }),
                    ],
                });
            },
            async buildInitialLinks(context, document) {
                const payload = parseFeePayoutResolvePayload(document);
                const dependency = await requireDocument(context.db, payload.feePayoutInitiateDocumentId, "fee_payout_initiate", "fee_payout_initiate");
                const parentCase = await requireParentCase(context.db, dependency.id);
                return [
                    { toDocumentId: parentCase.id, linkType: "parent" },
                    { toDocumentId: dependency.id, linkType: "depends_on" },
                ];
            },
            buildPostIdempotencyKey(document) {
                return buildDocumentPostIdempotencyKey(document);
            },
        };
    };
}
export function createFeePayoutInitiateDocumentModule(deps) {
    return {
        moduleId: DOCUMENT_MODULE_ID.FEE_PAYOUT_INITIATE,
        docType: "fee_payout_initiate",
        docNoPrefix: "FPI",
        payloadVersion: 1,
        createSchema: FeePayoutInitiateSchema,
        updateSchema: FeePayoutInitiateSchema,
        payloadSchema: FeePayoutInitiateSchema.transform(normalizeFeePayoutInitiatePayload),
        postingRequired: true,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizeFeePayoutInitiatePayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizeFeePayoutInitiatePayload(input));
        },
        deriveSummary(document) {
            const payload = parseFeePayoutInitiatePayload(document);
            return {
                title: `Fee payout ${payload.currency}`,
                amountMinor: toMinor(payload.amountMinor),
                currency: payload.currency,
                memo: payload.memo ?? null,
                counterpartyId: payload.payoutCounterpartyId,
                operationalAccountId: payload.payoutOperationalAccountId,
                searchText: [
                    document.docNo,
                    payload.componentId,
                    payload.feeBucket,
                    payload.accountingTreatment,
                    payload.currency,
                    payload.payoutCounterpartyId,
                    payload.payoutOperationalAccountId,
                    payload.memo ?? "",
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate(context, input) {
            await Promise.all([
                ensureCaseExists(context.db, input.caseDocumentId),
                requireDocument(context.db, input.fxExecuteDocumentId, "fx_execute", "fx_execute"),
                ensureCounterpartyExists(context.db, input.payoutCounterpartyId),
            ]);
        },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canCancel() { },
        async canPost(context, document) {
            const payload = parseFeePayoutInitiatePayload(document);
            const fxDocument = await requireDependency(context.db, document.id, "fx_execute");
            const caseDocument = await requireParentCase(context.db, document.id);
            ensurePosted(fxDocument, "fx_execute");
            if (caseDocument.id !== payload.caseDocumentId) {
                throw new DocumentValidationError("payment_case link does not match fee_payout_initiate payload");
            }
            const fxPayload = parseFxExecutePayload(fxDocument);
            if (fxPayload.caseDocumentId !== payload.caseDocumentId) {
                throw new DocumentValidationError("fx_execute case does not match fee payout");
            }
            await Promise.all([
                ensureCounterpartyExists(context.db, payload.payoutCounterpartyId),
                ensureOperationalAccountCurrency(context.db, deps.currenciesService, payload.payoutOperationalAccountId, payload.currency),
            ]);
            const fxDetails = await buildFxExecutionArtifacts({
                context,
                document: fxDocument,
                payload: fxPayload,
                feesService: deps.feesService,
                currenciesService: deps.currenciesService,
                consumeQuote: false,
            });
            const component = fxDetails.separateFeeComponents.find((item) => item.componentId === payload.componentId);
            if (!component) {
                throw new DocumentValidationError(`FX execution does not expose separate fee component ${payload.componentId}`);
            }
            if (component.bucket !== payload.feeBucket) {
                throw new DocumentValidationError("feeBucket does not match fx_execute component");
            }
            if (component.accountingTreatment !== payload.accountingTreatment) {
                throw new DocumentValidationError("accountingTreatment does not match fx_execute component");
            }
            if (component.currency !== payload.currency) {
                throw new DocumentValidationError("currency does not match fx_execute component");
            }
            if (component.amountMinor !== toMinor(payload.amountMinor)) {
                throw new DocumentValidationError("amountMinor does not match fx_execute component");
            }
        },
        async buildPostingPlan(context, document) {
            const payload = parseFeePayoutInitiatePayload(document);
            const timeoutSeconds = payload.timeoutSeconds ?? DAY_IN_SECONDS;
            const pendingRef = `fee_payment:${payload.componentId}:init`;
            return buildDocumentPostingPlan({
                operationCode: OPERATION_CODE.TREASURY_FEE_PAYMENT_INIT,
                payload: {
                    paymentCaseId: payload.caseDocumentId,
                    componentId: payload.componentId,
                    railRef: payload.railRef,
                    amountMinor: payload.amountMinor,
                    currency: payload.currency,
                    feeBucket: payload.feeBucket,
                    accountingTreatment: payload.accountingTreatment,
                    payoutCounterpartyId: payload.payoutCounterpartyId,
                    payoutOperationalAccountId: payload.payoutOperationalAccountId,
                    memo: payload.memo ?? null,
                },
                requests: [
                    buildDocumentPostingRequest(document, {
                        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_INITIATE,
                        currency: payload.currency,
                        amountMinor: toMinor(payload.amountMinor),
                        dimensions: {
                            feeBucket: payload.feeBucket,
                            orderId: payload.caseDocumentId,
                            counterpartyId: payload.payoutCounterpartyId,
                            operationalAccountId: payload.payoutOperationalAccountId,
                        },
                        refs: {
                            componentId: payload.componentId,
                            railRef: payload.railRef,
                        },
                        pending: {
                            timeoutSeconds,
                            ref: pendingRef,
                        },
                        memo: payload.memo ?? "Fee payment initiated (pending)",
                    }),
                ],
            });
        },
        async buildInitialLinks(_context, document) {
            const payload = parseFeePayoutInitiatePayload(document);
            return [
                { toDocumentId: payload.caseDocumentId, linkType: "parent" },
                { toDocumentId: payload.fxExecuteDocumentId, linkType: "depends_on" },
            ];
        },
        async buildDetails(context, document) {
            const pendingTransferIds = await loadPendingTransferIdsForDocument(context.db, document.id);
            return {
                computed: { pendingTransferIds },
            };
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
export function createFeePayoutSettleDocumentModule() {
    return createFeePayoutResolveModule({
        moduleId: DOCUMENT_MODULE_ID.FEE_PAYOUT_SETTLE,
        docType: "fee_payout_settle",
        docNoPrefix: "FPS",
        eventType: "settle",
    })();
}
export function createFeePayoutVoidDocumentModule() {
    return createFeePayoutResolveModule({
        moduleId: DOCUMENT_MODULE_ID.FEE_PAYOUT_VOID,
        docType: "fee_payout_void",
        docNoPrefix: "FPV",
        eventType: "void",
    })();
}
