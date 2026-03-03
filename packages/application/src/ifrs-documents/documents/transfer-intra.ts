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
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
  type TransferIntraInput,
} from "../validation";
import {
  ensureTransferCurrencies,
  normalizeTransferPayload,
  resolveTransferBindings,
} from "./internal/transfer-helpers";
import type { IfrsModuleDeps } from "./internal/types";

export function createTransferIntraDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<TransferIntraInput, TransferIntraInput> {
  const { counterpartyAccountsService } = deps;

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
    allowDirectPostFromDraft: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination accounts from the same counterparty",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    async updateDraft(_context, _document, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination accounts from the same counterparty",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);

      return {
        title: "Внутренний перевод",
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.sourceCounterpartyId,
        counterpartyAccountId: payload.sourceCounterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.sourceCounterpartyAccountId,
          payload.destinationCounterpartyAccountId,
          payload.sourceCounterpartyId,
          payload.currency,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      ensureTransferCurrencies({
        payloadCurrency: input.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires accounts from the same counterparty",
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
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);
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
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);

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
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
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
