
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { parseMinorAmount } from "@bedrock/shared/money";

import { requireDraftMetadata } from "./draft-metadata";
import { firstString } from "./summary";
import type { IfrsDocumentType } from "../../metadata";

function buildSimpleSummary(input: {
  draft: { docNo: string; docType: string };
  title: string;
  payload: Record<string, unknown>;
}) {
  return {
    title: input.title,
    amountMinor: parseMinorAmount(input.payload.amountMinor),
    currency:
      typeof input.payload.currency === "string"
        ? input.payload.currency
        : null,
    memo:
      typeof input.payload.memo === "string" ? input.payload.memo : null,
    counterpartyId: firstString(input.payload, [
      "counterpartyId",
      "debtorCounterpartyId",
      "sourceCounterpartyId",
    ]),
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.title,
      firstString(input.payload, [
        "counterpartyId",
        "debtorCounterpartyId",
        "creditorCounterpartyId",
        "reference",
      ]) ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function createSimpleIfrsDocumentModule<
  TPayload extends { occurredAt: Date },
>(input: {
  docType: IfrsDocumentType;
  docNoPrefix: string;
  title: string;
  approvalRequired?: boolean;
  payloadSchema: DocumentModule<TPayload, TPayload>["payloadSchema"];
  createSchema: DocumentModule<TPayload, TPayload>["createSchema"];
  updateSchema: DocumentModule<TPayload, TPayload>["updateSchema"];
}): DocumentModule<TPayload, TPayload> {
  return {
    moduleId: input.docType,
    accountingSourceIds: [],
    docType: input.docType,
    docNoPrefix: input.docNoPrefix,
    payloadVersion: 1,
    createSchema: input.createSchema,
    updateSchema: input.updateSchema,
    payloadSchema: input.payloadSchema,
    postingRequired: false,
    allowDirectPostFromDraft: false,
    approvalRequired: () => input.approvalRequired ?? false,
    async createDraft(context, payload) {
      const draft = requireDraftMetadata(context);
      const normalizedPayload = serializeOccurredAt(payload);

      return buildDocumentDraft(
        payload,
        normalizedPayload,
        buildSimpleSummary({
          draft,
          title: input.title,
          payload: normalizedPayload,
        }),
      );
    },
    async updateDraft(context, _document, payload) {
      const draft = requireDraftMetadata(context);
      const normalizedPayload = serializeOccurredAt(payload);

      return buildDocumentDraft(
        payload,
        normalizedPayload,
        buildSimpleSummary({
          draft,
          title: input.title,
          payload: normalizedPayload,
        }),
      );
    },
    async canCreate() {},
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
