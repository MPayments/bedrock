import { eq } from "drizzle-orm";
import { z } from "zod";
import { DOCUMENT_MODULE_ID, OPERATION_CODE, POSTING_TEMPLATE_KEY, } from "@bedrock/accounting-contracts";
import { schema } from "@bedrock/db/schema";
import { DocumentValidationError } from "@bedrock/documents";
import { amountMinorSchema, buildDocumentDraft, buildDocumentPostIdempotencyKey, parseDocumentPayload, serializeOccurredAt, } from "./internal/document-utils";
import { buildDocumentPostingPlan, buildDocumentPostingRequest, } from "./internal/posting-plan";
const ExternalFundingPayloadSchema = z.object({
    kind: z.enum([
        "founder_equity",
        "investor_equity",
        "shareholder_loan",
        "opening_balance",
    ]),
    operationalAccountId: z.uuid(),
    currency: z
        .string()
        .min(2)
        .max(16)
        .transform((value) => value.trim().toUpperCase()),
    amountMinor: amountMinorSchema,
    entryRef: z.string().min(1).max(255),
    occurredAt: z.coerce.date(),
    memo: z.string().max(1000).optional(),
    counterpartyId: z.uuid().optional(),
    customerId: z.uuid().optional(),
});
function normalizeExternalFundingPayload(payload) {
    return {
        ...serializeOccurredAt(payload),
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId ?? null,
        customerId: payload.customerId ?? null,
    };
}
const EXTERNAL_FUNDING_BY_KIND = {
    founder_equity: {
        templateKey: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_FOUNDER_EQUITY,
    },
    investor_equity: {
        templateKey: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_INVESTOR_EQUITY,
    },
    shareholder_loan: {
        templateKey: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
    },
    opening_balance: {
        templateKey: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_OPENING_BALANCE,
    },
};
function buildCreditDimensions(payload) {
    if (payload.counterpartyId) {
        return { counterpartyId: payload.counterpartyId };
    }
    return {};
}
async function ensureCounterpartyExists(counterpartyId, db) {
    const [counterparty] = await db
        .select({ id: schema.counterparties.id })
        .from(schema.counterparties)
        .where(eq(schema.counterparties.id, counterpartyId))
        .limit(1);
    if (!counterparty) {
        throw new DocumentValidationError(`Counterparty not found: ${counterpartyId}`);
    }
}
async function ensureCustomerExists(customerId, db) {
    const [customer] = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(eq(schema.customers.id, customerId))
        .limit(1);
    if (!customer) {
        throw new DocumentValidationError(`Customer not found: ${customerId}`);
    }
}
export function createExternalFundingDocumentModule(deps) {
    const { currenciesService } = deps;
    return {
        moduleId: DOCUMENT_MODULE_ID.EXTERNAL_FUNDING,
        docType: "external_funding",
        docNoPrefix: "FUN",
        payloadVersion: 1,
        createSchema: ExternalFundingPayloadSchema,
        updateSchema: ExternalFundingPayloadSchema,
        payloadSchema: ExternalFundingPayloadSchema.transform(normalizeExternalFundingPayload),
        postingRequired: true,
        approvalRequired() {
            return false;
        },
        async createDraft(_context, input) {
            return buildDocumentDraft(input, normalizeExternalFundingPayload(input));
        },
        async updateDraft(_context, _document, input) {
            return buildDocumentDraft(input, normalizeExternalFundingPayload(input));
        },
        deriveSummary(document) {
            const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);
            return {
                title: `External funding: ${payload.kind}`,
                amountMinor: BigInt(payload.amountMinor),
                currency: payload.currency,
                memo: payload.memo ?? null,
                counterpartyId: payload.counterpartyId ?? null,
                customerId: payload.customerId ?? null,
                operationalAccountId: payload.operationalAccountId,
                searchText: [
                    document.docNo,
                    payload.kind,
                    payload.currency,
                    payload.entryRef,
                    payload.memo ?? "",
                    payload.counterpartyId ?? "",
                    payload.customerId ?? "",
                    payload.operationalAccountId,
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        },
        async canCreate() { },
        async canEdit() { },
        async canSubmit() { },
        async canApprove() { },
        async canReject() { },
        async canCancel() { },
        async canPost(context, document) {
            const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);
            const [operationalAccount] = await context.db
                .select({
                id: schema.operationalAccounts.id,
                currencyId: schema.operationalAccounts.currencyId,
            })
                .from(schema.operationalAccounts)
                .where(eq(schema.operationalAccounts.id, payload.operationalAccountId))
                .for("update")
                .limit(1);
            if (!operationalAccount) {
                throw new DocumentValidationError(`Operational account not found: ${payload.operationalAccountId}`);
            }
            const accountCurrency = await currenciesService.findById(operationalAccount.currencyId);
            if (accountCurrency.code !== payload.currency) {
                throw new DocumentValidationError(`currency mismatch: expected ${accountCurrency.code}, got ${payload.currency}`);
            }
            if (payload.counterpartyId) {
                await ensureCounterpartyExists(payload.counterpartyId, context.db);
            }
            if (payload.customerId) {
                await ensureCustomerExists(payload.customerId, context.db);
            }
        },
        async buildPostingPlan(_context, document) {
            const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);
            const config = EXTERNAL_FUNDING_BY_KIND[payload.kind];
            const dimensions = {
                operationalAccountId: payload.operationalAccountId,
            };
            Object.assign(dimensions, buildCreditDimensions(payload));
            return buildDocumentPostingPlan({
                operationCode: OPERATION_CODE.TREASURY_EXTERNAL_FUNDING,
                payload: {
                    kind: payload.kind,
                    entryRef: payload.entryRef,
                    operationalAccountId: payload.operationalAccountId,
                    currency: payload.currency,
                    amountMinor: payload.amountMinor,
                    counterpartyId: payload.counterpartyId ?? null,
                    customerId: payload.customerId ?? null,
                    memo: payload.memo ?? null,
                },
                requests: [
                    buildDocumentPostingRequest(document, {
                        templateKey: config.templateKey,
                        currency: payload.currency,
                        amountMinor: BigInt(payload.amountMinor),
                        dimensions,
                        refs: {
                            entryRef: payload.entryRef,
                            kind: payload.kind,
                        },
                        memo: payload.memo ?? `External funding: ${payload.kind}`,
                    }),
                ],
            });
        },
        buildPostIdempotencyKey(document) {
            return buildDocumentPostIdempotencyKey(document);
        },
    };
}
