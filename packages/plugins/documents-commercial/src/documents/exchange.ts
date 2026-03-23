import {
  ACCOUNTING_SOURCE_ID,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  ExchangeInputSchema,
  ExchangePayloadSchema,
  type ExchangeInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  buildExchangePostingPlan,
  getExchangeAcceptance,
  getInvoiceExchangeChild,
  loadInvoice,
  parseInvoicePayload,
  requirePostedDocument,
  resolveOrganizationBinding,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

function buildExchangeSummary(input: {
  draft: { docNo: string; docType: string };
  payload: {
    invoiceDocumentId: string;
    executionRef?: string | null;
    customerId: string;
    counterpartyId: string;
    organizationRequisiteId: string;
    quoteSnapshot: { fromAmountMinor: string; fromCurrency: string; quoteRef: string };
    memo?: string | null;
  };
}) {
  return {
    title: "Обмен",
    amountMinor: BigInt(input.payload.quoteSnapshot.fromAmountMinor),
    currency: input.payload.quoteSnapshot.fromCurrency,
    memo: input.payload.memo ?? null,
    counterpartyId: input.payload.counterpartyId,
    customerId: input.payload.customerId,
    organizationRequisiteId: input.payload.organizationRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.invoiceDocumentId,
      input.payload.executionRef,
      input.payload.quoteSnapshot.quoteRef,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function createExchangeDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<ExchangeInput, ExchangeInput> {
  return {
    moduleId: "exchange",
    accountingSourceId: ACCOUNTING_SOURCE_ID.FX_EXECUTE,
    docType: "exchange",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.exchange.docNoPrefix,
    payloadVersion: 1,
    createSchema: ExchangeInputSchema,
    updateSchema: ExchangeInputSchema,
    payloadSchema: ExchangePayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const invoice = await loadInvoice(
        deps,
        context.runtime,
        input.invoiceDocumentId,
        true,
      );
      requirePostedDocument(invoice);
      const invoicePayload = parseInvoicePayload(invoice);

      if (invoicePayload.mode !== "exchange") {
        throw new DocumentValidationError(
          "exchange can only be created for exchange-mode invoices",
        );
      }
      if (await getInvoiceExchangeChild(deps, context.runtime, invoice.id)) {
        throw new DocumentValidationError(
          "exchange already exists for this invoice",
        );
      }

      const payload = {
        ...serializeOccurredAt(input),
        customerId: invoicePayload.customerId,
        counterpartyId: invoicePayload.counterpartyId,
        organizationId: invoicePayload.organizationId,
        organizationRequisiteId: invoicePayload.organizationRequisiteId,
        quoteSnapshot: invoicePayload.quoteSnapshot,
        memo: input.memo,
      };

      return buildDocumentDraft(
        input,
        payload,
        buildExchangeSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, document, input) {
      const payload = parseDocumentPayload(ExchangePayloadSchema, document);
      if (payload.invoiceDocumentId !== input.invoiceDocumentId) {
        throw new DocumentValidationError(
          "exchange cannot change invoiceDocumentId",
        );
      }
      if (await getExchangeAcceptance(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "exchange cannot be edited after acceptance exists",
        );
      }
      return this.createDraft!(context, input);
    },
    async canCreate(context, input) {
      const invoice = await loadInvoice(
        deps,
        context.runtime,
        input.invoiceDocumentId,
        true,
      );
      requirePostedDocument(invoice);
      const invoicePayload = parseInvoicePayload(invoice);
      if (invoicePayload.mode !== "exchange") {
        throw new DocumentValidationError(
          "exchange can only be created for exchange-mode invoices",
        );
      }
      if (await getInvoiceExchangeChild(deps, context.runtime, invoice.id)) {
        throw new DocumentValidationError(
          "exchange already exists for this invoice",
        );
      }
    },
    async canEdit(context, document) {
      if (await getExchangeAcceptance(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "exchange cannot be edited after acceptance exists",
        );
      }
    },
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(ExchangePayloadSchema, document);
      await resolveOrganizationBinding(deps, payload.organizationRequisiteId);
    },
    async canCancel(context, document) {
      if (await getExchangeAcceptance(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "exchange cannot be cancelled after acceptance exists",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(ExchangePayloadSchema, document);
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );

      return buildExchangePostingPlan({
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(ExchangePayloadSchema, document);
      return [
        {
          toDocumentId: payload.invoiceDocumentId,
          linkType: "parent",
        },
      ];
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
