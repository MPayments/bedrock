import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { formatFractionDecimal } from "@bedrock/shared/money";
import { minorToAmountString } from "@bedrock/shared/money";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  FxExecuteInputSchema,
  FxExecutePayloadSchema,
  FxExecuteQuoteSnapshotSchema,
  type FxExecuteInput,
  type FxExecutePayload,
} from "../validation";
import {
  buildTreasuryFxFinancialLineRequests,
  buildTreasuryFxQuoteIdempotencyKey,
  ensureFxBindingsConvertible,
  ensureFxBindingsMatchQuote,
  loadFxQuoteSnapshot,
  markFxQuoteUsed,
  normalizeFxExecuteAmount,
  normalizeFxExecutePayload,
  revalidateFxQuoteSnapshot,
  resolveFxBindings,
} from "./internal/fx-helpers";
import type { IfrsDocumentRuntime, IfrsModuleDeps } from "./internal/types";

function assertFxExecuteAmountMatchesQuote(payload: FxExecutePayload) {
  if (payload.amountMinor !== payload.quoteSnapshot.fromAmountMinor) {
    throw new DocumentValidationError(
      `Stored amount ${payload.amountMinor} does not match quote amount ${payload.quoteSnapshot.fromAmountMinor}`,
    );
  }
}

function formatRate(rateNum: string, rateDen: string) {
  return formatFractionDecimal(rateNum, rateDen, {
    scale: 6,
    trimTrailingZeros: false,
  });
}

function buildFxExecuteDetails(payload: FxExecutePayload) {
  return {
    quoteId: payload.quoteSnapshot.quoteId,
    quoteIdempotencyKey: payload.quoteSnapshot.idempotencyKey,
    sourceAmount: payload.amount,
    sourceAmountMinor: payload.amountMinor,
    sourceCurrency: payload.quoteSnapshot.fromCurrency,
    destinationAmount: minorToAmountString(
      BigInt(payload.quoteSnapshot.toAmountMinor),
      {
        currency: payload.quoteSnapshot.toCurrency,
      },
    ),
    destinationAmountMinor: payload.quoteSnapshot.toAmountMinor,
    destinationCurrency: payload.quoteSnapshot.toCurrency,
    effectiveRate: formatRate(
      payload.quoteSnapshot.rateNum,
      payload.quoteSnapshot.rateDen,
    ),
    quoteExpiresAt: payload.quoteSnapshot.expiresAt,
    generatedFinancialLines: payload.financialLines.filter(
      (line) => line.source === "rule",
    ),
  };
}

async function prepareDraftPayload(
  deps: IfrsModuleDeps,
  context: {
    runtime: IfrsDocumentRuntime;
    now: Date;
    operationIdempotencyKey: string | null;
  },
  input: FxExecuteInput,
) {
  const bindings = await resolveFxBindings(deps.requisitesService, input);
  ensureFxBindingsConvertible(bindings);

  const amount = normalizeFxExecuteAmount({
    amount: input.amount,
    sourceCurrency: bindings.source.currencyCode,
  });

  const quoteSnapshot = input.quoteId
    ? FxExecuteQuoteSnapshotSchema.parse(
        await deps.treasuryFxQuote.loadQuoteSnapshotById({
          runtime: context.runtime,
          quoteId: input.quoteId,
        }),
      )
    : await loadFxQuoteSnapshot(deps, {
        runtime: context.runtime,
        fromCurrency: bindings.source.currencyCode,
        toCurrency: bindings.destination.currencyCode,
        fromAmountMinor: amount.amountMinor,
        asOf: context.now,
        idempotencyKey: buildTreasuryFxQuoteIdempotencyKey(
          context.operationIdempotencyKey,
        ),
      });

  ensureFxBindingsMatchQuote({
    source: bindings.source,
    destination: bindings.destination,
    quoteSnapshot,
  });

  return normalizeFxExecutePayload(input, bindings, amount, quoteSnapshot);
}

export function createFxExecuteDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<FxExecuteInput, FxExecuteInput> {
  return {
    moduleId: "fx_execute",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
    docType: "fx_execute",
    docNoPrefix: IFRS_DOCUMENT_METADATA.fx_execute.docNoPrefix,
    payloadVersion: 1,
    createSchema: FxExecuteInputSchema,
    updateSchema: FxExecuteInputSchema,
    payloadSchema: FxExecutePayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const payload = await prepareDraftPayload(deps, context, input);
      return buildDocumentDraft(input, payload);
    },
    async updateDraft(context, _document, input) {
      const payload = await prepareDraftPayload(deps, context, input);
      return buildDocumentDraft(input, payload);
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(FxExecutePayloadSchema, document);

      return {
        title:
          payload.ownershipMode === "cross_org"
            ? "Казначейский FX (между организациями)"
            : "Казначейский FX",
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.quoteSnapshot.fromCurrency,
        memo: payload.memo ?? null,
        counterpartyId: null,
        organizationRequisiteId: payload.sourceRequisiteId,
        searchText: [
          document.docNo,
          document.docType,
          payload.sourceOrganizationId,
          payload.destinationOrganizationId,
          payload.sourceRequisiteId,
          payload.destinationRequisiteId,
          payload.quoteSnapshot.quoteId,
          payload.quoteSnapshot.idempotencyKey,
          payload.quoteSnapshot.fromCurrency,
          payload.quoteSnapshot.toCurrency,
          payload.executionRef,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveFxBindings(deps.requisitesService, input);
      ensureFxBindingsConvertible(bindings);
      normalizeFxExecuteAmount({
        amount: input.amount,
        sourceCurrency: bindings.source.currencyCode,
      });
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(FxExecutePayloadSchema, document);
      const bindings = await resolveFxBindings(deps.requisitesService, payload);

      ensureFxBindingsMatchQuote({
        source: bindings.source,
        destination: bindings.destination,
        quoteSnapshot: payload.quoteSnapshot,
      });
      assertFxExecuteAmountMatchesQuote(payload);

      await revalidateFxQuoteSnapshot(deps, context.runtime, payload);
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(FxExecutePayloadSchema, document);
      const bindings = await resolveFxBindings(deps.requisitesService, payload);
      const isPending = Boolean(payload.timeoutSeconds);
      const chainId = `fx_execute:${document.id}`;
      const baseDimensions = {
        sourceRequisiteId: payload.sourceRequisiteId,
        destinationRequisiteId: payload.destinationRequisiteId,
        sourceOrganizationId: payload.sourceOrganizationId,
        destinationOrganizationId: payload.destinationOrganizationId,
      };

      assertFxExecuteAmountMatchesQuote(payload);

      await markFxQuoteUsed({
        deps,
        runtime: context.runtime,
        quoteId: payload.quoteSnapshot.quoteId,
        fxExecuteDocumentId: document.id,
        at: context.now,
      });

      const requests = [
        buildDocumentPostingRequest(document, {
          templateKey: isPending
            ? POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_PENDING
            : POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
          bookId: bindings.source.bookId,
          currency: payload.quoteSnapshot.fromCurrency,
          amountMinor: BigInt(payload.amountMinor),
          dimensions: baseDimensions,
          refs: {
            fxExecuteDocumentId: document.id,
            quoteId: payload.quoteSnapshot.quoteId,
            chainId,
            ...(payload.executionRef
              ? { executionRef: payload.executionRef }
              : {}),
          },
          pending: isPending
            ? {
                timeoutSeconds: payload.timeoutSeconds,
                ref: `fx_execute:${document.id}:source`,
              }
            : null,
          memo: payload.memo ?? null,
        }),
        buildDocumentPostingRequest(document, {
          templateKey: isPending
            ? POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_PENDING
            : POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_IMMEDIATE,
          bookId: bindings.destination.bookId,
          currency: payload.quoteSnapshot.toCurrency,
          amountMinor: BigInt(payload.quoteSnapshot.toAmountMinor),
          dimensions: baseDimensions,
          refs: {
            fxExecuteDocumentId: document.id,
            quoteId: payload.quoteSnapshot.quoteId,
            chainId,
            ...(payload.executionRef
              ? { executionRef: payload.executionRef }
              : {}),
          },
          pending: isPending
            ? {
                timeoutSeconds: payload.timeoutSeconds,
                ref: `fx_execute:${document.id}:destination`,
              }
            : null,
          memo: payload.memo ?? null,
        }),
      ];

      if (!isPending) {
        requests.push(
          ...buildTreasuryFxFinancialLineRequests({
            document,
            sourceBookId: bindings.source.bookId,
            sourceCurrency: payload.quoteSnapshot.fromCurrency,
            destinationBookId: bindings.destination.bookId,
            destinationCurrency: payload.quoteSnapshot.toCurrency,
            quoteId: payload.quoteSnapshot.quoteId,
            chainId,
            executionRef: payload.executionRef ?? null,
            fxExecuteDocumentId: document.id,
            baseDimensions,
            lines: payload.financialLines,
          }),
        );
      }

      return buildDocumentPostingPlan({
        operationCode: isPending
          ? OPERATION_CODE.TREASURY_FX_EXECUTE_PENDING
          : OPERATION_CODE.TREASURY_FX_EXECUTE_IMMEDIATE,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests,
      });
    },
    async buildDetails(_context, document) {
      const payload = parseDocumentPayload(FxExecutePayloadSchema, document);
      return {
        computed: buildFxExecuteDetails(payload),
      };
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
