
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { parseMinorAmount } from "@bedrock/shared/money";

import { firstString } from "./summary";
import type { IfrsDocumentType } from "../../metadata";

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
    async createDraft(_context, payload) {
      return buildDocumentDraft(payload, serializeOccurredAt(payload));
    },
    async updateDraft(_context, _document, payload) {
      return buildDocumentDraft(payload, serializeOccurredAt(payload));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(
        input.payloadSchema,
        document,
      ) as Record<string, unknown>;

      return {
        title: input.title,
        amountMinor: parseMinorAmount(payload.amountMinor),
        currency:
          typeof payload.currency === "string" ? payload.currency : null,
        memo: typeof payload.memo === "string" ? payload.memo : null,
        counterpartyId: firstString(payload, [
          "counterpartyId",
          "debtorCounterpartyId",
          "sourceCounterpartyId",
        ]),
        searchText: [
          document.docNo,
          document.docType,
          input.title,
          firstString(payload, [
            "counterpartyId",
            "debtorCounterpartyId",
            "creditorCounterpartyId",
            "reference",
          ]) ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
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
