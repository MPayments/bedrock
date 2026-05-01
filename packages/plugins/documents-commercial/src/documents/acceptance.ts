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
  AcceptanceInputSchema,
  AcceptancePayloadSchema,
  type AcceptanceInput,
} from "../validation";
import {
  getApplicationAcceptanceChild,
  getInvoicePurpose,
  loadApplication,
  loadInvoice,
  parseApplicationPayload,
  parseInvoicePayload,
  requirePostedDocument,
  requireReadyDocument,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

async function resolveAcceptanceDraftContext(
  deps: CommercialModuleDeps,
  context: Parameters<DocumentModule<AcceptanceInput, AcceptanceInput>["createDraft"]>[0],
  input: AcceptanceInput,
) {
  const application = await loadApplication(
    deps,
    context.runtime,
    input.applicationDocumentId,
    true,
  );
  requireReadyDocument(application);

  if (
    await getApplicationAcceptanceChild(deps, context.runtime, application.id)
  ) {
    throw new DocumentValidationError(
      "acceptance already exists for this application",
    );
  }

  const applicationPayload = parseApplicationPayload(application);
  const invoiceDocumentId = input.invoiceDocumentId;
  const settlementEvidenceFileAssetIds =
    input.settlementEvidenceFileAssetIds ?? [];
  if (settlementEvidenceFileAssetIds.length === 0) {
    throw new DocumentValidationError(
      "acceptance requires final SWIFT/MT103 payout evidence",
    );
  }

  if (invoiceDocumentId) {
    const invoice = await loadInvoice(
      deps,
      context.runtime,
      invoiceDocumentId,
      true,
    );
    requirePostedDocument(invoice);
    if (getInvoicePurpose(parseInvoicePayload(invoice)) === "agency_fee") {
      throw new DocumentValidationError(
        "acceptance must reference the principal invoice, not the agency fee invoice",
      );
    }
  }

  return {
    application,
    applicationPayload,
    invoiceDocumentId,
    settlementEvidenceFileAssetIds,
  };
}

export function createAcceptanceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<AcceptanceInput, AcceptanceInput> {
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
      const {
        applicationPayload,
        invoiceDocumentId,
        settlementEvidenceFileAssetIds,
      } =
        await resolveAcceptanceDraftContext(deps, context, input);

      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        applicationDocumentId: input.applicationDocumentId,
        invoiceDocumentId,
        settlementEvidenceFileAssetIds,
        counterpartyId: applicationPayload.counterpartyId,
        customerId: applicationPayload.customerId,
        organizationId: applicationPayload.organizationId,
        organizationRequisiteId: applicationPayload.organizationRequisiteId,
        memo: input.memo,
      });
    },
    async updateDraft(context, document, input) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);
      if (payload.applicationDocumentId !== input.applicationDocumentId) {
        throw new DocumentValidationError(
          "acceptance cannot change applicationDocumentId",
        );
      }

      return this.createDraft!(context, input);
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);

      return {
        title: "Акт / подтверждение исполнения",
        memo: payload.memo ?? null,
        counterpartyId:
          typeof document.payload.counterpartyId === "string"
            ? document.payload.counterpartyId
            : undefined,
        customerId:
          typeof document.payload.customerId === "string"
            ? document.payload.customerId
            : undefined,
        organizationRequisiteId:
          typeof document.payload.organizationRequisiteId === "string"
            ? document.payload.organizationRequisiteId
            : undefined,
        searchText: [
          document.docNo,
          document.docType,
          payload.applicationDocumentId,
          payload.invoiceDocumentId,
          ...payload.settlementEvidenceFileAssetIds,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      await resolveAcceptanceDraftContext(deps, context, input);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    async buildInitialLinks(context, document) {
      const payload = parseDocumentPayload(AcceptancePayloadSchema, document);
      const links: {
        toDocumentId: string;
        linkType: "parent" | "depends_on";
      }[] = [
        {
          toDocumentId: payload.applicationDocumentId,
          linkType: "parent" as const,
        },
      ];
      if (payload.invoiceDocumentId) {
        links.push({
          toDocumentId: payload.invoiceDocumentId,
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
