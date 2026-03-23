import {
  ACCOUNTING_SOURCE_ID,
} from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import {
  DocumentValidationError,
} from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  InvoiceInputSchema,
  InvoicePayloadSchema,
  compileInvoiceDirectFinancialLines,
  type InvoiceInput,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  buildDirectInvoicePostingPlan,
  buildExchangeInvoicePostingPlan,
  getInvoiceAcceptanceChild,
  getInvoiceExchangeChild,
  loadQuoteSnapshot,
  parseInvoicePayload,
  resolveOrganizationBinding,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

function buildInvoiceSummary(input: {
  draft: { docNo: string; docType: string };
  payload: ReturnType<typeof parseInvoicePayload>;
}) {
  return {
    title: input.payload.mode === "exchange" ? "Инвойс (обмен)" : "Инвойс",
    amountMinor:
      input.payload.mode === "exchange"
        ? BigInt(input.payload.quoteSnapshot.fromAmountMinor)
        : BigInt(input.payload.amountMinor),
    currency:
      input.payload.mode === "exchange"
        ? input.payload.quoteSnapshot.fromCurrency
        : input.payload.currency,
    memo: input.payload.memo ?? null,
    counterpartyId: input.payload.counterpartyId,
    customerId: input.payload.customerId,
    organizationRequisiteId: input.payload.organizationRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.customerId,
      input.payload.counterpartyId,
      input.payload.mode,
      input.payload.mode === "exchange"
        ? input.payload.quoteSnapshot.quoteRef
        : input.payload.currency,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function createInvoiceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<InvoiceInput, InvoiceInput> {
  function buildInvoiceExchangeQuoteIdempotencyKey(
    operationIdempotencyKey: string | null,
  ) {
    if (!operationIdempotencyKey) {
      throw new DocumentValidationError(
        "invoice exchange quote generation requires an operation idempotency key",
      );
    }

    return `documents.invoice.exchange.quote:${operationIdempotencyKey}`;
  }

  function getGeneratedExchangeInput(
    input: Extract<InvoiceInput, { mode: "exchange" }>,
  ): {
    currency: string;
    targetCurrency: string;
    amountMinor: string;
  } | null {
    if (
      !input.quoteRef &&
      typeof input.currency === "string" &&
      input.currency.length > 0 &&
      typeof input.targetCurrency === "string" &&
      input.targetCurrency.length > 0 &&
      "amountMinor" in input &&
      typeof input.amountMinor === "string" &&
      input.amountMinor.length > 0
    ) {
      return {
        currency: input.currency,
        targetCurrency: input.targetCurrency,
        amountMinor: input.amountMinor,
      };
    }

    return null;
  }

  return {
    moduleId: "invoice",
    accountingSourceIds: [
      ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
    ],
    docType: "invoice",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.invoice.docNoPrefix,
    payloadVersion: 1,
    createSchema: InvoiceInputSchema,
    updateSchema: InvoiceInputSchema,
    payloadSchema: InvoicePayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);

      if (input.mode === "direct") {
        const payload = {
          ...serializeOccurredAt(input),
          financialLines: compileInvoiceDirectFinancialLines({
            financialLines: input.financialLines,
            amountMinor: input.amountMinor,
            currency: input.currency,
          }),
          memo: input.memo,
        };

        return buildDocumentDraft(
          input,
          payload,
          buildInvoiceSummary({
            draft,
            payload,
          }),
        );
      }

      const generatedExchangeInput = getGeneratedExchangeInput(input);

      if (!input.quoteRef && !generatedExchangeInput) {
        throw new DocumentValidationError(
          "exchange invoice quote input is incomplete",
        );
      }

      const quoteSnapshot = input.quoteRef
        ? await loadQuoteSnapshot({
            runtime: context.runtime,
            deps,
            quoteRef: input.quoteRef,
          })
        : await deps.quoteSnapshot.createQuoteSnapshot({
            runtime: context.runtime,
            fromCurrency: generatedExchangeInput!.currency,
            toCurrency: generatedExchangeInput!.targetCurrency,
            fromAmountMinor: generatedExchangeInput!.amountMinor,
            asOf: context.now,
            idempotencyKey: buildInvoiceExchangeQuoteIdempotencyKey(
              context.operationIdempotencyKey,
            ),
          });

      const payload = {
        ...serializeOccurredAt(input),
        quoteSnapshot,
        memo: input.memo,
      };

      return buildDocumentDraft(
        input,
        payload,
        buildInvoiceSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, document, input) {
      if (document.lifecycleStatus !== "active") {
        throw new DocumentValidationError("invoice is not active");
      }
      if (await getInvoiceExchangeChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be edited after an exchange child exists",
        );
      }
      if (await getInvoiceAcceptanceChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be edited after an acceptance child exists",
        );
      }
      return this.createDraft!(context, input);
    },
    async canCreate(_context, input) {
      await Promise.all([
        deps.partyReferences.assertCustomerExists(input.customerId),
        deps.partyReferences.assertCounterpartyExists(input.counterpartyId),
      ]);

      const binding = await resolveOrganizationBinding(
        deps,
        input.organizationRequisiteId,
      );

      if (input.organizationId && input.organizationId !== binding.organizationId) {
        throw new DocumentValidationError(
          "organizationId does not match selected organization requisite",
        );
      }

      if (input.mode === "exchange") {
        if (input.quoteRef) {
          const quoteSnapshot = await loadQuoteSnapshot({
            runtime: _context.runtime,
            deps,
            quoteRef: input.quoteRef,
          });

          if (binding.currencyCode !== quoteSnapshot.fromCurrency) {
            throw new DocumentValidationError(
              `Currency mismatch: quote=${quoteSnapshot.fromCurrency}, account=${binding.currencyCode}`,
            );
          }
        } else if (binding.currencyCode !== input.currency) {
          throw new DocumentValidationError(
            `Currency mismatch: invoice=${input.currency}, account=${binding.currencyCode}`,
          );
        }
      } else if (binding.currencyCode !== input.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: invoice=${input.currency}, account=${binding.currencyCode}`,
        );
      }
    },
    async canEdit(context, document) {
      if (await getInvoiceExchangeChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be edited after an exchange child exists",
        );
      }
      if (await getInvoiceAcceptanceChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be edited after an acceptance child exists",
        );
      }
    },
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost(context, document) {
      const payload = parseInvoicePayload(document);
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );

      if (
        payload.mode === "exchange" &&
        binding.currencyCode !== payload.quoteSnapshot.fromCurrency
      ) {
        throw new DocumentValidationError(
          `Currency mismatch: quote=${payload.quoteSnapshot.fromCurrency}, account=${binding.currencyCode}`,
        );
      }
      if (payload.mode === "direct" && binding.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: invoice=${payload.currency}, account=${binding.currencyCode}`,
        );
      }
    },
    async canCancel(context, document) {
      if (await getInvoiceExchangeChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be cancelled after an exchange child exists",
        );
      }
      if (await getInvoiceAcceptanceChild(deps, context.runtime, document.id)) {
        throw new DocumentValidationError(
          "invoice cannot be cancelled after an acceptance child exists",
        );
      }
    },
    async buildPostingPlan(context, document) {
      const payload = parseInvoicePayload(document);
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );

      if (payload.mode === "direct") {
        return buildDirectInvoicePostingPlan({
          document,
          payload,
          bookId: binding.bookId,
        });
      }

      return buildExchangeInvoicePostingPlan({
        deps,
        context,
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    resolveAccountingSourceId(_context, document) {
      const payload = parseInvoicePayload(document);
      return payload.mode === "direct"
        ? ACCOUNTING_SOURCE_ID.INVOICE_DIRECT
        : ACCOUNTING_SOURCE_ID.INVOICE_RESERVE;
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
