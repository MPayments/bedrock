import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  FxExecutePayloadSchema,
  FxResolutionInputSchema,
  FxResolutionPayloadSchema,
  type FxResolutionInput,
} from "../validation";
import {
  buildTreasuryFxFinancialLineRequests,
  listPendingFxTransfers,
  resolveFxBindings,
  resolveFxExecuteDependencyDocument,
} from "./internal/fx-helpers";
import type { IfrsModuleDeps } from "./internal/types";
import { resolvePendingTransferBookId } from "./internal/transfer-helpers";

function resolveFxResolutionTitle(resolutionType: "settle" | "void" | "fail") {
  if (resolutionType === "settle") {
    return "Разрешение казначейского FX (исполнение)";
  }

  if (resolutionType === "void") {
    return "Разрешение казначейского FX (аннулирование)";
  }

  return "Разрешение казначейского FX (ошибка)";
}

export function createFxResolutionDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<FxResolutionInput, FxResolutionInput> {
  return {
    moduleId: "fx_resolution",
    accountingSourceIds: [
      ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_VOID,
    ],
    docType: "fx_resolution",
    docNoPrefix: IFRS_DOCUMENT_METADATA.fx_resolution.docNoPrefix,
    payloadVersion: 1,
    createSchema: FxResolutionInputSchema,
    updateSchema: FxResolutionInputSchema,
    payloadSchema: FxResolutionPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        fxExecuteDocumentId: input.fxExecuteDocumentId,
        resolutionType: input.resolutionType,
        eventIdempotencyKey: input.eventIdempotencyKey,
        memo: input.memo,
      });
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        fxExecuteDocumentId: input.fxExecuteDocumentId,
        resolutionType: input.resolutionType,
        eventIdempotencyKey: input.eventIdempotencyKey,
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(FxResolutionPayloadSchema, document);

      return {
        title: resolveFxResolutionTitle(payload.resolutionType),
        searchText: [
          document.docNo,
          document.docType,
          payload.fxExecuteDocumentId,
          payload.resolutionType,
          payload.eventIdempotencyKey,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      await resolveFxExecuteDependencyDocument(
        deps,
        context.db as any,
        input.fxExecuteDocumentId,
      );
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(FxResolutionPayloadSchema, document);
      await resolveFxExecuteDependencyDocument(
        deps,
        context.db as any,
        payload.fxExecuteDocumentId,
      );
      await listPendingFxTransfers(deps, context.db as any, payload.fxExecuteDocumentId);
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(FxResolutionPayloadSchema, document);
      const fxExecuteDocument = await resolveFxExecuteDependencyDocument(
        deps,
        context.db as any,
        payload.fxExecuteDocumentId,
      );
      const fxExecutePayload = parseDocumentPayload(
        FxExecutePayloadSchema,
        fxExecuteDocument,
      );
      const bindings = await resolveFxBindings(deps.requisitesService, fxExecutePayload);
      const pendingTransfers = await listPendingFxTransfers(
        deps,
        context.db as any,
        payload.fxExecuteDocumentId,
      );
      const settle = payload.resolutionType === "settle";
      const chainId = `fx_execute:${payload.fxExecuteDocumentId}`;
      const baseDimensions = {
        sourceRequisiteId: fxExecutePayload.sourceRequisiteId,
        destinationRequisiteId: fxExecutePayload.destinationRequisiteId,
        sourceOrganizationId: fxExecutePayload.sourceOrganizationId,
        destinationOrganizationId: fxExecutePayload.destinationOrganizationId,
      };

      const requests = pendingTransfers.map((pending) =>
        buildDocumentPostingRequest(document, {
          templateKey: settle
            ? POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_SETTLE
            : POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_VOID,
          bookId: resolvePendingTransferBookId({
            sourceBookId: bindings.source.bookId,
            destinationBookId: bindings.destination.bookId,
            pendingRef: pending.pendingRef,
          }),
          currency: pending.pendingRef?.endsWith(":destination")
            ? fxExecutePayload.quoteSnapshot.toCurrency
            : fxExecutePayload.quoteSnapshot.fromCurrency,
          amountMinor: pending.amountMinor,
          dimensions: {},
          refs: {
            fxExecuteDocumentId: payload.fxExecuteDocumentId,
            eventIdempotencyKey: payload.eventIdempotencyKey,
            chainId,
          },
          pending: {
            pendingId: pending.transferId,
            ref: pending.pendingRef,
            amountMinor: settle ? pending.amountMinor : 0n,
          },
          memo: payload.memo ?? null,
        }),
      );

      if (settle) {
        requests.push(
          ...buildTreasuryFxFinancialLineRequests({
            document,
            sourceBookId: bindings.source.bookId,
            sourceCurrency: fxExecutePayload.quoteSnapshot.fromCurrency,
            destinationBookId: bindings.destination.bookId,
            destinationCurrency: fxExecutePayload.quoteSnapshot.toCurrency,
            quoteId: fxExecutePayload.quoteSnapshot.quoteId,
            chainId,
            executionRef: fxExecutePayload.executionRef ?? null,
            fxExecuteDocumentId: payload.fxExecuteDocumentId,
            baseDimensions,
            lines: fxExecutePayload.financialLines,
          }),
        );
      }

      return buildDocumentPostingPlan({
        operationCode: settle
          ? OPERATION_CODE.TREASURY_FX_SETTLE_PENDING
          : OPERATION_CODE.TREASURY_FX_VOID_PENDING,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests,
      });
    },
    resolveAccountingSourceId(_context, _document, postingPlan) {
      return postingPlan.operationCode === OPERATION_CODE.TREASURY_FX_SETTLE_PENDING
        ? ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE
        : ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_VOID;
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(FxResolutionPayloadSchema, document);
      return [
        {
          toDocumentId: payload.fxExecuteDocumentId,
          linkType: "depends_on",
        },
      ];
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
