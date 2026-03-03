import type { DocumentModule } from "@bedrock/core/documents";
import { DocumentValidationError } from "@bedrock/core/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/core/documents/module-kit";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/kernel/accounting-contracts";

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

export function createCapitalFundingDocumentModule(
  deps: IfrsModuleDeps,
): DocumentModule<CapitalFundingInput, CapitalFundingInput> {
  const { counterpartyAccountsService } = deps;

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
        counterpartyAccountId: payload.counterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.kind,
          payload.entryRef,
          payload.counterpartyId,
          payload.counterpartyAccountId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [input.counterpartyAccountId],
      });
      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }
      if (binding.counterpartyId !== input.counterpartyId) {
        throw new DocumentValidationError(
          "counterpartyId does not match counterpartyAccountId owner",
        );
      }
      if (binding.currencyCode !== input.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${input.currency}, account=${binding.currencyCode}`,
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
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [payload.counterpartyAccountId],
      });
      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }
      if (binding.counterpartyId !== payload.counterpartyId) {
        throw new DocumentValidationError(
          "counterpartyId does not match counterpartyAccountId owner",
        );
      }
      if (binding.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${payload.currency}, account=${binding.currencyCode}`,
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [payload.counterpartyAccountId],
      });

      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }

      return buildDocumentPostingPlan({
        operationCode: OPERATION_CODE.TREASURY_CAPITAL_FUNDING,
        payload: {
          ...payload,
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
              counterpartyAccountId: payload.counterpartyAccountId,
            },
            refs: {
              entryRef: payload.entryRef,
              kind: payload.kind,
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
