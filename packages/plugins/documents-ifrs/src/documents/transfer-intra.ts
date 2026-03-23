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

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
  type TransferIntraInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  ensureTransferCurrencies,
  normalizeTransferIntraPayload,
  resolveTransferBindings,
} from "./internal/transfer-helpers";
import type { IfrsModuleDeps } from "./internal/types";

function buildTransferIntraSummary(input: {
  draft: { docNo: string; docType: string };
  payload: {
    amountMinor: string;
    currency: string;
    memo?: string | null;
    organizationId: string;
    sourceRequisiteId: string;
    destinationRequisiteId: string;
  };
}) {
  return {
    title: "Внутренний перевод",
    amountMinor: BigInt(input.payload.amountMinor),
    currency: input.payload.currency,
    memo: input.payload.memo ?? null,
    counterpartyId: null,
    organizationRequisiteId: input.payload.sourceRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.organizationId,
      input.payload.sourceRequisiteId,
      input.payload.destinationRequisiteId,
      input.payload.currency,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function createTransferIntraDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<TransferIntraInput, TransferIntraInput> {
  const { requisitesService } = deps;

  return {
    moduleId: "transfer_intra",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TRANSFER_INTRA,
    docType: "transfer_intra",
    docNoPrefix: IFRS_DOCUMENT_METADATA.transfer_intra.docNoPrefix,
    payloadVersion: 1,
    createSchema: TransferIntraInputSchema,
    updateSchema: TransferIntraInputSchema,
    payloadSchema: TransferIntraPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const bindings = await resolveTransferBindings(
        requisitesService,
        input,
      );
      if (bindings.source.organizationId !== bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination requisites from the same organization",
        );
      }
      const payload = normalizeTransferIntraPayload(input, bindings);

      return buildDocumentDraft(
        input,
        payload,
        buildTransferIntraSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, _document, input) {
      const draft = requireDraftMetadata(context);
      const bindings = await resolveTransferBindings(
        requisitesService,
        input,
      );
      if (bindings.source.organizationId !== bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination requisites from the same organization",
        );
      }
      const payload = normalizeTransferIntraPayload(input, bindings);

      return buildDocumentDraft(
        input,
        payload,
        buildTransferIntraSummary({
          draft,
          payload,
        }),
      );
    },
    async canCreate(_context, input) {
      const bindings = await resolveTransferBindings(
        requisitesService,
        input,
      );
      ensureTransferCurrencies({
        payloadCurrency: input.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.organizationId !== input.organizationId) {
        throw new DocumentValidationError(
          "organizationId does not match selected source requisite",
        );
      }
      if (bindings.destination.organizationId !== input.organizationId) {
        throw new DocumentValidationError(
          "transfer_intra requires requisites from the same organization",
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);
      const bindings = await resolveTransferBindings(
        requisitesService,
        payload,
      );
      ensureTransferCurrencies({
        payloadCurrency: payload.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });

      if (bindings.source.bookId !== bindings.destination.bookId) {
        throw new DocumentValidationError(
          "transfer_intra requires both accounts in the same book",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);
      const bindings = await resolveTransferBindings(
        requisitesService,
        payload,
      );

      if (bindings.source.bookId !== bindings.destination.bookId) {
        throw new DocumentValidationError(
          "transfer_intra requires both accounts in the same book",
        );
      }

      const isPending = Boolean(payload.timeoutSeconds);
      const templateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE;
      const operationCode = isPending
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_INTRA;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey,
            bookId: bindings.source.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              sourceRequisiteId: payload.sourceRequisiteId,
              destinationRequisiteId: payload.destinationRequisiteId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}`,
                }
              : null,
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
