import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  OutgoingInvoiceInputSchema,
  OutgoingInvoicePayloadSchema,
  type OutgoingInvoiceInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  buildOutgoingInvoicePostingPlan,
  resolveCommercialDocumentTitle,
  resolveOrganizationBinding,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

function buildOutgoingInvoiceSummary(input: {
  draft: { docNo: string; docType: string };
  payload: ReturnType<typeof OutgoingInvoicePayloadSchema.parse>;
}) {
  return {
    title: resolveCommercialDocumentTitle({
      docType: "outgoing_invoice",
      contour: input.payload.contour,
    }),
    amountMinor: BigInt(input.payload.amountMinor),
    currency: input.payload.currency,
    memo: input.payload.memo ?? null,
    counterpartyId: input.payload.counterpartyId,
    organizationRequisiteId: input.payload.organizationRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.counterpartyId,
      input.payload.counterpartyRequisiteId,
      input.payload.organizationId,
      input.payload.organizationRequisiteId,
      input.payload.currency,
      input.payload.amount,
      input.payload.memo,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function normalizeOutgoingInvoicePayload(input: OutgoingInvoiceInput) {
  return OutgoingInvoicePayloadSchema.parse({
    ...serializeOccurredAt(input),
    memo: input.memo ?? undefined,
  });
}

export function createOutgoingInvoiceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<OutgoingInvoiceInput, OutgoingInvoiceInput> {
  return {
    moduleId: "outgoing_invoice",
    accountingSourceId: ACCOUNTING_SOURCE_ID.OUTGOING_INVOICE,
    docType: "outgoing_invoice",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.outgoing_invoice.docNoPrefix,
    payloadVersion: 1,
    createSchema: OutgoingInvoiceInputSchema,
    updateSchema: OutgoingInvoiceInputSchema,
    payloadSchema: OutgoingInvoicePayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const payload = normalizeOutgoingInvoicePayload(
        OutgoingInvoiceInputSchema.parse(input),
      );

      return buildDocumentDraft(
        input,
        payload,
        buildOutgoingInvoiceSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, _document, input) {
      const draft = requireDraftMetadata(context);
      const payload = normalizeOutgoingInvoicePayload(
        OutgoingInvoiceInputSchema.parse(input),
      );

      return buildDocumentDraft(
        input,
        payload,
        buildOutgoingInvoiceSummary({
          draft,
          payload,
        }),
      );
    },
    async canCreate(_context, input) {
      const payload = OutgoingInvoiceInputSchema.parse(input);
      await deps.partyReferences.assertCounterpartyExists(payload.counterpartyId);
      await resolveOrganizationBinding(deps, payload.organizationRequisiteId);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(OutgoingInvoicePayloadSchema, document);
      await deps.partyReferences.assertCounterpartyExists(payload.counterpartyId);
      await resolveOrganizationBinding(deps, payload.organizationRequisiteId);
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(OutgoingInvoicePayloadSchema, document);
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );

      return buildOutgoingInvoicePostingPlan({
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
