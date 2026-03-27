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
  IncomingInvoiceInputSchema,
  IncomingInvoicePayloadSchema,
  type IncomingInvoiceInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  buildIncomingInvoiceDetails,
  buildIncomingInvoicePostingPlan,
  parseIncomingInvoicePayload,
  resolveCommercialDocumentTitle,
  resolveOrganizationBinding,
  listIncomingInvoicePaymentOrders,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

function buildIncomingInvoiceSummary(input: {
  draft: { docNo: string; docType: string };
  payload: ReturnType<typeof IncomingInvoicePayloadSchema.parse>;
}) {
  return {
    title: resolveCommercialDocumentTitle({
      docType: "incoming_invoice",
      contour: input.payload.contour,
    }),
    amountMinor: BigInt(input.payload.amountMinor),
    currency: input.payload.currency,
    memo: input.payload.memo ?? null,
    counterpartyId: input.payload.counterpartyId,
    customerId: input.payload.customerId,
    organizationRequisiteId: input.payload.organizationRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.customerId,
      input.payload.counterpartyId,
      input.payload.organizationId,
      input.payload.organizationRequisiteId,
      input.payload.currency,
      input.payload.amount,
      input.payload.externalBasis?.sourceSystem,
      input.payload.externalBasis?.entityType,
      input.payload.externalBasis?.entityId,
      input.payload.externalBasis?.documentNumber,
      input.payload.memo,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function normalizeIncomingInvoicePayload(input: IncomingInvoiceInput) {
  return IncomingInvoicePayloadSchema.parse({
    ...serializeOccurredAt(input),
    memo: input.memo ?? undefined,
  });
}

export function createIncomingInvoiceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<IncomingInvoiceInput, IncomingInvoiceInput> {
  return {
    moduleId: "incoming_invoice",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_OBLIGATION_OPENED,
    docType: "incoming_invoice",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.incoming_invoice.docNoPrefix,
    payloadVersion: 1,
    createSchema: IncomingInvoiceInputSchema,
    updateSchema: IncomingInvoiceInputSchema,
    payloadSchema: IncomingInvoicePayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const payload = normalizeIncomingInvoicePayload(
        IncomingInvoiceInputSchema.parse(input),
      );

      return buildDocumentDraft(
        input,
        payload,
        buildIncomingInvoiceSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, _document, input) {
      const draft = requireDraftMetadata(context);
      const payload = normalizeIncomingInvoicePayload(
        IncomingInvoiceInputSchema.parse(input),
      );

      return buildDocumentDraft(
        input,
        payload,
        buildIncomingInvoiceSummary({
          draft,
          payload,
        }),
      );
    },
    async canCreate(_context, input) {
      const payload = IncomingInvoiceInputSchema.parse(input);
      await deps.partyReferences.assertCustomerExists(payload.customerId);
      await deps.partyReferences.assertCounterpartyExists(payload.counterpartyId);
      await deps.partyReferences.assertCounterpartyLinkedToCustomer({
        customerId: payload.customerId,
        counterpartyId: payload.counterpartyId,
      });
      await resolveOrganizationBinding(deps, payload.organizationRequisiteId);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(IncomingInvoicePayloadSchema, document);
      await deps.partyReferences.assertCustomerExists(payload.customerId);
      await deps.partyReferences.assertCounterpartyExists(payload.counterpartyId);
      await deps.partyReferences.assertCounterpartyLinkedToCustomer({
        customerId: payload.customerId,
        counterpartyId: payload.counterpartyId,
      });
      await resolveOrganizationBinding(deps, payload.organizationRequisiteId);
    },
    async buildPostingPlan(_context, document) {
      const payload = parseIncomingInvoicePayload(document);
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );
      await deps.treasuryState.ensureIncomingInvoiceObligation({ document });

      return buildIncomingInvoicePostingPlan({
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    async buildDetails(context, document) {
      const payload = parseIncomingInvoicePayload(document);
      const paymentOrders = await listIncomingInvoicePaymentOrders(
        deps,
        context.runtime,
        document.id,
      );

      return {
        computed: buildIncomingInvoiceDetails({
          payload,
          paymentOrders,
        }),
      };
    },
  };
}
