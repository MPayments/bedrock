import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  CapitalFundingInputSchema,
  CapitalFundingPayloadSchema,
  type CapitalFundingInput,
} from "../validation";
import type { IfrsModuleDeps } from "./internal/types";

function resolveFundingTemplateKey(kind: CapitalFundingInput["kind"]) {
  switch (kind) {
    case "founder_equity":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_FOUNDER_EQUITY;
    case "investor_equity":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_INVESTOR_EQUITY;
    case "shareholder_loan":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_SHAREHOLDER_LOAN;
    case "opening_balance":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_OPENING_BALANCE;
    default:
      throw new DocumentValidationError(`Unsupported funding kind: ${kind}`);
  }
}

function resolveCapitalFundingTitle(kind: CapitalFundingInput["kind"]) {
  if (kind === "founder_equity") {
    return "Капитальное финансирование (вклад учредителя)";
  }

  if (kind === "investor_equity") {
    return "Капитальное финансирование (вклад инвестора)";
  }

  if (kind === "shareholder_loan") {
    return "Капитальное финансирование (заем акционера)";
  }

  return "Капитальное финансирование (входящий остаток)";
}

function resolveCapitalFundingEntryRef(input: {
  document: { docNo: string };
  payload: { entryRef?: string };
}) {
  return input.payload.entryRef ?? input.document.docNo;
}

export function createCapitalFundingDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<CapitalFundingInput, CapitalFundingInput> {
  const { requisitesService } = deps;

  return {
    moduleId: "capital_funding",
    accountingSourceId: ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING,
    docType: "capital_funding",
    docNoPrefix: IFRS_DOCUMENT_METADATA.capital_funding.docNoPrefix,
    payloadVersion: 1,
    createSchema: CapitalFundingInputSchema,
    updateSchema: CapitalFundingInputSchema,
    payloadSchema: CapitalFundingPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);

      return {
        title: resolveCapitalFundingTitle(payload.kind),
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId,
        organizationRequisiteId: payload.organizationRequisiteId,
        searchText: [
          document.docNo,
          document.docType,
          payload.kind,
          payload.entryRef,
          payload.organizationId,
          payload.counterpartyId,
          payload.organizationRequisiteId,
          payload.counterpartyRequisiteId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const [binding, counterpartyRequisite] = await Promise.all([
        requisitesService.resolveBindings({
          requisiteIds: [input.organizationRequisiteId],
        }),
        requisitesService.findById(input.counterpartyRequisiteId),
      ]);
      const organizationBinding = binding[0];
      if (!organizationBinding) {
        throw new DocumentValidationError(
          "Organization requisite binding is missing",
        );
      }
      if (organizationBinding.organizationId !== input.organizationId) {
        throw new DocumentValidationError(
          "organizationId does not match selected organization requisite",
        );
      }
      if (organizationBinding.currencyCode !== input.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${input.currency}, account=${organizationBinding.currencyCode}`,
        );
      }
      if (
        counterpartyRequisite.ownerType !== "counterparty" ||
        counterpartyRequisite.ownerId !== input.counterpartyId
      ) {
        throw new DocumentValidationError(
          "counterpartyId does not match selected counterparty requisite",
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);
      const [binding, counterpartyRequisite] = await Promise.all([
        requisitesService.resolveBindings({
          requisiteIds: [payload.organizationRequisiteId],
        }),
        requisitesService.findById(payload.counterpartyRequisiteId),
      ]);
      const organizationBinding = binding[0];
      if (!organizationBinding) {
        throw new DocumentValidationError(
          "Organization requisite binding is missing",
        );
      }
      if (organizationBinding.organizationId !== payload.organizationId) {
        throw new DocumentValidationError(
          "organizationId does not match selected organization requisite",
        );
      }
      if (organizationBinding.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${payload.currency}, account=${organizationBinding.currencyCode}`,
        );
      }
      if (
        counterpartyRequisite.ownerType !== "counterparty" ||
        counterpartyRequisite.ownerId !== payload.counterpartyId
      ) {
        throw new DocumentValidationError(
          "counterpartyId does not match selected counterparty requisite",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);
      const [binding] = await requisitesService.resolveBindings({
        requisiteIds: [payload.organizationRequisiteId],
      });
      const entryRef = resolveCapitalFundingEntryRef({ document, payload });

      if (!binding) {
        throw new DocumentValidationError(
          "Organization requisite binding is missing",
        );
      }

      return buildDocumentPostingPlan({
        operationCode: OPERATION_CODE.TREASURY_CAPITAL_FUNDING,
        payload: {
          ...payload,
          entryRef,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey: resolveFundingTemplateKey(payload.kind),
            bookId: binding.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              counterpartyId: payload.counterpartyId,
              organizationRequisiteId: payload.organizationRequisiteId,
            },
            refs: {
              entryRef,
              kind: payload.kind,
              counterpartyRequisiteId: payload.counterpartyRequisiteId,
            },
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
