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
  TransferIntercompanyInputSchema,
  TransferIntercompanyPayloadSchema,
  type TransferIntercompanyInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  ensureTransferCurrencies,
  normalizeTransferIntercompanyPayload,
  resolveTransferBindings,
} from "./internal/transfer-helpers";
import type { IfrsModuleDeps } from "./internal/types";

function buildTransferIntercompanySummary(input: {
  draft: { docNo: string; docType: string };
  payload: {
    amountMinor: string;
    currency: string;
    memo?: string | null;
    sourceOrganizationId: string;
    destinationOrganizationId: string;
    sourceRequisiteId: string;
    destinationRequisiteId: string;
  };
}) {
  return {
    title: "Межкорпоративный перевод",
    amountMinor: BigInt(input.payload.amountMinor),
    currency: input.payload.currency,
    memo: input.payload.memo ?? null,
    counterpartyId: null,
    organizationRequisiteId: input.payload.sourceRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.sourceOrganizationId,
      input.payload.destinationOrganizationId,
      input.payload.sourceRequisiteId,
      input.payload.destinationRequisiteId,
      input.payload.currency,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function createTransferIntercompanyDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<TransferIntercompanyInput, TransferIntercompanyInput> {
  const { requisitesService } = deps;

  return {
    moduleId: "transfer_intercompany",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
    docType: "transfer_intercompany",
    docNoPrefix: IFRS_DOCUMENT_METADATA.transfer_intercompany.docNoPrefix,
    payloadVersion: 1,
    createSchema: TransferIntercompanyInputSchema,
    updateSchema: TransferIntercompanyInputSchema,
    payloadSchema: TransferIntercompanyPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const bindings = await resolveTransferBindings(
        requisitesService,
        input,
      );
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different organizations",
        );
      }
      const payload = normalizeTransferIntercompanyPayload(input, bindings);

      return buildDocumentDraft(
        input,
        payload,
        buildTransferIntercompanySummary({
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
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different organizations",
        );
      }
      const payload = normalizeTransferIntercompanyPayload(input, bindings);

      return buildDocumentDraft(
        input,
        payload,
        buildTransferIntercompanySummary({
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
      if (bindings.source.organizationId !== input.sourceOrganizationId) {
        throw new DocumentValidationError(
          "sourceOrganizationId does not match selected source requisite",
        );
      }
      if (bindings.destination.organizationId !== input.destinationOrganizationId) {
        throw new DocumentValidationError(
          "destinationOrganizationId does not match selected destination requisite",
        );
      }
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires requisites from different organizations",
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);
      const bindings = await resolveTransferBindings(
        requisitesService,
        payload,
      );
      ensureTransferCurrencies({
        payloadCurrency: payload.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires requisites from different organizations",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);
      const bindings = await resolveTransferBindings(
        requisitesService,
        payload,
      );
      const isPending = Boolean(payload.timeoutSeconds);

      const sourceTemplateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_IMMEDIATE;
      const destinationTemplateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_IMMEDIATE;
      const operationCode = isPending
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey: sourceTemplateKey,
            bookId: bindings.source.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              sourceRequisiteId: payload.sourceRequisiteId,
              destinationOrganizationId: payload.destinationOrganizationId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}:source`,
                }
              : null,
            memo: payload.memo ?? null,
          }),
          buildDocumentPostingRequest(document, {
            templateKey: destinationTemplateKey,
            bookId: bindings.destination.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              destinationRequisiteId: payload.destinationRequisiteId,
              sourceOrganizationId: payload.sourceOrganizationId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}:destination`,
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
