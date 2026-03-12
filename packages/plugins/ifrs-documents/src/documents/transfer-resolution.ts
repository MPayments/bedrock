import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/documents";
import { DocumentValidationError } from "@bedrock/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/documents/module-kit";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  TransferIntercompanyPayloadSchema,
  TransferIntraPayloadSchema,
  TransferResolutionInputSchema,
  TransferResolutionPayloadSchema,
  type TransferResolutionInput,
} from "../validation";
import {
  listPendingTransfers,
  resolvePendingTransferBookId,
  resolveTransferBindings,
  resolveTransferDependencyDocument,
} from "./internal/transfer-helpers";
import type { IfrsModuleDeps } from "./internal/types";

function resolveTransferResolutionTitle(
  resolutionType: "settle" | "void" | "fail",
) {
  if (resolutionType === "settle") {
    return "Разрешение перевода (исполнение)";
  }

  if (resolutionType === "void") {
    return "Разрешение перевода (аннулирование)";
  }

  return "Разрешение перевода (ошибка)";
}

export function createTransferResolutionDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<TransferResolutionInput, TransferResolutionInput> {
  const { requisitesService } = deps;

  return {
    moduleId: "transfer_resolution",
    accountingSourceIds: [
      ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE,
      ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_VOID,
    ],
    docType: "transfer_resolution",
    docNoPrefix: IFRS_DOCUMENT_METADATA.transfer_resolution.docNoPrefix,
    payloadVersion: 1,
    createSchema: TransferResolutionInputSchema,
    updateSchema: TransferResolutionInputSchema,
    payloadSchema: TransferResolutionPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);

      return {
        title: resolveTransferResolutionTitle(payload.resolutionType),
        searchText: [
          document.docNo,
          document.docType,
          payload.transferDocumentId,
          payload.resolutionType,
          payload.eventIdempotencyKey,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      await resolveTransferDependencyDocument(context.db, input.transferDocumentId);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      await resolveTransferDependencyDocument(context.db, payload.transferDocumentId);
      await listPendingTransfers(context.db, payload.transferDocumentId);
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      const transferDocument = await resolveTransferDependencyDocument(
        context.db,
        payload.transferDocumentId,
      );
      const pendingTransfers = await listPendingTransfers(
        context.db,
        payload.transferDocumentId,
      );
      const pending = pendingTransfers[payload.pendingIndex];

      if (!pending) {
        throw new DocumentValidationError(
          `Pending transfer index ${payload.pendingIndex} is out of range`,
        );
      }

      const transferPayload =
        transferDocument.docType === "transfer_intra"
          ? parseDocumentPayload(TransferIntraPayloadSchema, transferDocument)
          : parseDocumentPayload(TransferIntercompanyPayloadSchema, transferDocument);

      const bindings = await resolveTransferBindings(
        requisitesService,
        transferPayload,
      );
      const bookId = resolvePendingTransferBookId({
        sourceBookId: bindings.source.bookId,
        destinationBookId: bindings.destination.bookId,
        pendingRef: pending.pendingRef,
      });

      const settle = payload.resolutionType === "settle";
      const templateKey = settle
        ? POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE
        : POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID;
      const operationCode = settle
        ? OPERATION_CODE.TRANSFER_SETTLE_PENDING
        : OPERATION_CODE.TRANSFER_VOID_PENDING;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey,
            bookId,
            currency: transferPayload.currency,
            amountMinor: BigInt(transferPayload.amountMinor),
            dimensions: {},
            refs: {
              transferDocumentId: payload.transferDocumentId,
              eventIdempotencyKey: payload.eventIdempotencyKey,
              pendingIndex: String(payload.pendingIndex),
            },
            pending: {
              pendingId: pending.transferId,
              ref: pending.pendingRef,
              amountMinor: settle ? pending.amountMinor : 0n,
            },
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    resolveAccountingSourceId(_context, _document, postingPlan) {
      return postingPlan.operationCode === OPERATION_CODE.TRANSFER_SETTLE_PENDING
        ? ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE
        : ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_VOID;
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      return [
        {
          toDocumentId: payload.transferDocumentId,
          linkType: "depends_on",
        },
      ];
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
