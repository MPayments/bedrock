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
import {
  buildExchangePostingPlan,
  getExchangeAcceptance,
  getInvoiceExchangeChild,
  loadInvoice,
  parseInvoicePayload,
  requirePostedDocument,
  resolveInvoiceDealFxContext,
  resolveOrganizationBinding,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

async function resolveExchangeDraftContext(
  deps: CommercialModuleDeps,
  context: {
    runtime: Parameters<
      CommercialModuleDeps["documentRelations"]["loadInvoice"]
    >[0]["runtime"];
  },
  invoiceDocumentId: string,
) {
  const invoice = await loadInvoice(
    deps,
    context.runtime,
    invoiceDocumentId,
    true,
  );
  requirePostedDocument(invoice);

  if (await getInvoiceExchangeChild(deps, context.runtime, invoice.id)) {
    throw new DocumentValidationError(
      "exchange already exists for this invoice",
    );
  }

  const invoicePayload = parseInvoicePayload(invoice);
  const dealFxContext = await resolveInvoiceDealFxContext(deps, invoice.id);

  if (dealFxContext) {
    if (!dealFxContext.hasConvertLeg) {
      throw new DocumentValidationError(
        "exchange can only be created for deals with a convert leg",
      );
    }

    if (!dealFxContext.calculationId) {
      throw new DocumentValidationError(
        "exchange requires an accepted calculation linked to the deal",
      );
    }

    if (!dealFxContext.quoteSnapshot) {
      throw new DocumentValidationError(
        "exchange requires an accepted FX quote linked to the deal",
      );
    }

    return {
      financialLines: dealFxContext.financialLines,
      invoice,
      invoicePayload,
      quoteSnapshot: dealFxContext.quoteSnapshot,
    };
  }

  throw new DocumentValidationError(
    "exchange requires an invoice linked to an FX deal",
  );
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
      const { invoicePayload, quoteSnapshot } = await resolveExchangeDraftContext(
        deps,
        context,
        input.invoiceDocumentId,
      );

      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        customerId: invoicePayload.customerId,
        counterpartyId: invoicePayload.counterpartyId,
        organizationId: invoicePayload.organizationId,
        organizationRequisiteId: invoicePayload.organizationRequisiteId,
        quoteSnapshot,
        memo: input.memo,
      });
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
    deriveSummary(document) {
      const payload = parseDocumentPayload(ExchangePayloadSchema, document);

      return {
        title: "Обмен",
        amountMinor: BigInt(payload.quoteSnapshot.fromAmountMinor),
        currency: payload.quoteSnapshot.fromCurrency,
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId,
        customerId: payload.customerId,
        organizationRequisiteId: payload.organizationRequisiteId,
        searchText: [
          document.docNo,
          document.docType,
          payload.invoiceDocumentId,
          payload.executionRef,
          payload.quoteSnapshot.quoteRef,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      await resolveExchangeDraftContext(
        deps,
        context,
        input.invoiceDocumentId,
      );
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
      const dealFxContext = await resolveInvoiceDealFxContext(
        deps,
        payload.invoiceDocumentId,
      );

      return buildExchangePostingPlan({
        document,
        financialLines:
          dealFxContext?.hasConvertLeg ? dealFxContext.financialLines : undefined,
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
