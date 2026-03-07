import type { DocumentModule } from "@bedrock/core/documents";
import { DocumentValidationError } from "@bedrock/core/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
} from "@bedrock/core/documents/module-kit";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/kernel/accounting-contracts";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  TransferIntercompanyInputSchema,
  TransferIntercompanyPayloadSchema,
  type TransferIntercompanyInput,
} from "../validation";
import {
  ensureTransferCurrencies,
  normalizeTransferPayload,
  resolveTransferBindings,
} from "./internal/transfer-helpers";
import type { IfrsModuleDeps } from "./internal/types";

export function createTransferIntercompanyDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<TransferIntercompanyInput, TransferIntercompanyInput> {
  const { organizationRequisitesService } = deps;

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
    allowDirectPostFromDraft: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      const bindings = await resolveTransferBindings(
        organizationRequisitesService,
        input,
      );
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different organizations",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    async updateDraft(_context, _document, input) {
      const bindings = await resolveTransferBindings(
        organizationRequisitesService,
        input,
      );
      if (bindings.source.organizationId === bindings.destination.organizationId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different organizations",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);

      return {
        title: "Межкорпоративный перевод",
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.sourceCounterpartyId,
        counterpartyAccountId: payload.sourceCounterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.sourceCounterpartyId,
          payload.destinationCounterpartyId,
          payload.sourceCounterpartyAccountId,
          payload.destinationCounterpartyAccountId,
          payload.currency,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveTransferBindings(
        organizationRequisitesService,
        input,
      );
      ensureTransferCurrencies({
        payloadCurrency: input.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
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
        organizationRequisitesService,
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
        organizationRequisitesService,
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
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyId: payload.destinationCounterpartyId,
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
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              sourceCounterpartyId: payload.sourceCounterpartyId,
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
