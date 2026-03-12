import type { DocumentModule } from "@bedrock/documents";
import { DocumentValidationError } from "@bedrock/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/documents/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  AcceptanceInputSchema,
  AcceptancePayloadSchema,
  type AcceptanceInput,
} from "../validation";
import {
  getInvoiceAcceptanceChild,
  getInvoiceExchangeChild,
  loadInvoice,
  parseInvoicePayload,
  requirePostedDocument,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

export function createAcceptanceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<
  AcceptanceInput,
  AcceptanceInput
> {
  return {
    moduleId: "acceptance",
    accountingSourceIds: [],
    docType: "acceptance",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.acceptance.docNoPrefix,
    payloadVersion: 1,
    createSchema: AcceptanceInputSchema,
    updateSchema: AcceptanceInputSchema,
    payloadSchema: AcceptancePayloadSchema,
    postingRequired: false,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const invoice = await loadInvoice(
        deps,
        context.db,
        input.invoiceDocumentId,
        true,
      );
      requirePostedDocument(invoice);
      const invoicePayload = parseInvoicePayload(invoice);

      if (await getInvoiceAcceptanceChild(deps, context.db, invoice.id)) {
        throw new DocumentValidationError(
          "acceptance already exists for this invoice",
        );
      }

      const exchange = await getInvoiceExchangeChild(
        deps,
        context.db,
        invoice.id,
      );
      if (invoicePayload.mode === "exchange") {
        if (!exchange) {
          throw new DocumentValidationError(
            "acceptance requires a posted exchange for exchange-mode invoices",
          );
        }
        requirePostedDocument(exchange);
      }

      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        invoiceMode: invoicePayload.mode,
        exchangeDocumentId: exchange?.id,
        memo: input.memo,
      });
    },
    async updateDraft(context, document, input) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);
      if (payload.invoiceDocumentId !== input.invoiceDocumentId) {
        throw new DocumentValidationError(
          "acceptance cannot change invoiceDocumentId",
        );
      }

      return this.createDraft!(context, input);
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);

      return {
        title: "Акт",
        memo: payload.memo ?? null,
        searchText: [
          document.docNo,
          document.docType,
          payload.invoiceDocumentId,
          payload.exchangeDocumentId,
          payload.invoiceMode,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      const invoice = await loadInvoice(
        deps,
        context.db,
        input.invoiceDocumentId,
        true,
      );
      requirePostedDocument(invoice);
      const invoicePayload = parseInvoicePayload(invoice);
      if (await getInvoiceAcceptanceChild(deps, context.db, invoice.id)) {
        throw new DocumentValidationError(
          "acceptance already exists for this invoice",
        );
      }

      if (invoicePayload.mode === "exchange") {
        const exchange = await getInvoiceExchangeChild(
          deps,
          context.db,
          invoice.id,
        );
        if (!exchange) {
          throw new DocumentValidationError(
            "acceptance requires a posted exchange for exchange-mode invoices",
          );
        }
        requirePostedDocument(exchange);
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    async buildInitialLinks(context, document) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);
      const links: Array<{
        toDocumentId: string;
        linkType: "parent" | "depends_on";
      }> = [
        {
          toDocumentId: payload.invoiceDocumentId,
          linkType: "parent" as const,
        },
      ];
      if (payload.exchangeDocumentId) {
        links.push({
          toDocumentId: payload.exchangeDocumentId,
          linkType: "depends_on" as const,
        });
      }

      return links;
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
