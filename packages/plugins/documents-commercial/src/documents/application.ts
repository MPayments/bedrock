import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  ApplicationInputSchema,
  ApplicationPayloadSchema,
  type ApplicationInput,
} from "../validation";
import type { CommercialModuleDeps } from "./internal/types";

export function createApplicationDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<ApplicationInput, ApplicationInput> {
  return {
    moduleId: "application",
    accountingSourceIds: [],
    docType: "application",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.application.docNoPrefix,
    payloadVersion: 1,
    createSchema: ApplicationInputSchema,
    updateSchema: ApplicationInputSchema,
    payloadSchema: ApplicationPayloadSchema,
    postingRequired: false,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        dealId: input.dealId,
        quoteId: input.quoteId,
        calculationId: input.calculationId,
        counterpartyId: input.counterpartyId,
        customerId: input.customerId,
        memo: input.memo,
        organizationId: input.organizationId,
        organizationRequisiteId: input.organizationRequisiteId,
      });
    },
    async updateDraft(_context, document, input) {
      const payload = ApplicationPayloadSchema.parse(document.payload);
      if (payload.dealId !== input.dealId) {
        throw new DocumentValidationError("application cannot change dealId");
      }
      if (payload.quoteId !== input.quoteId) {
        throw new DocumentValidationError("application cannot change quoteId");
      }
      if (payload.calculationId !== input.calculationId) {
        throw new DocumentValidationError(
          "application cannot change calculationId",
        );
      }
      if (payload.customerId !== input.customerId) {
        throw new DocumentValidationError("application cannot change customerId");
      }
      if (payload.counterpartyId !== input.counterpartyId) {
        throw new DocumentValidationError(
          "application cannot change counterpartyId",
        );
      }
      if (payload.organizationId !== input.organizationId) {
        throw new DocumentValidationError(
          "application cannot change organizationId",
        );
      }
      if (payload.organizationRequisiteId !== input.organizationRequisiteId) {
        throw new DocumentValidationError(
          "application cannot change organizationRequisiteId",
        );
      }

      return buildDocumentDraft(input, {
        ...payload,
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = ApplicationPayloadSchema.parse(document.payload);

      return {
        title: "Поручение",
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId,
        customerId: payload.customerId,
        organizationRequisiteId: payload.organizationRequisiteId,
        searchText: [
          document.docNo,
          document.docType,
          payload.dealId,
          payload.quoteId,
          payload.calculationId,
          payload.customerId,
          payload.counterpartyId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const existingDocumentId =
        await deps.documentBusinessLinks.findActiveDocumentIdByDealIdAndDocType(
          {
            dealId: input.dealId,
            docType: "application",
          },
        );

      if (existingDocumentId) {
        throw new DocumentValidationError(
          "application already exists for this deal",
        );
      }

      await Promise.all([
        deps.partyReferences.assertCustomerExists(input.customerId),
        deps.partyReferences.assertCounterpartyExists(input.counterpartyId),
      ]);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
