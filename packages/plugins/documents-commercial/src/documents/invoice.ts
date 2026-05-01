import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";
import type { DocumentModule } from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  InvoiceInputSchema,
  InvoicePayloadSchema,
  type InvoiceInput,
} from "../validation";
import {
  buildDealLinkedInvoicePostingPlan,
  buildDirectInvoicePostingPlan,
  buildInventoryFundedInvoicePostingPlan,
  calculateDealLinkedInvoiceExpectedAmount,
  getInvoiceAcceptanceChild,
  getInvoiceExchangeChild,
  getInvoiceAmountMinor,
  getInvoiceCurrency,
  getInvoicePurpose,
  getInvoiceTitleByPurpose,
  parseInvoicePayload,
  resolveInvoiceDealFxContext,
  resolveOrganizationBinding,
} from "./internal/helpers";
import type { CommercialModuleDeps } from "./internal/types";

function assertDealLinkedInvoiceMatchesCalculation(input: {
  dealFxContext: NonNullable<
    Awaited<ReturnType<typeof resolveInvoiceDealFxContext>>
  >;
  payload: {
    amountMinor: string;
    currency: string;
    invoicePurpose?: "combined" | "principal" | "agency_fee";
  };
}) {
  if (!input.dealFxContext.hasConvertLeg) {
    return;
  }

  const expected = calculateDealLinkedInvoiceExpectedAmount({
    dealFxContext: input.dealFxContext,
    purpose: input.payload.invoicePurpose ?? "combined",
  });

  if (input.payload.currency !== expected.currency) {
    throw new DocumentValidationError(
      `Currency mismatch: invoice=${input.payload.currency}, expected=${expected.currency}`,
    );
  }

  if (input.payload.amountMinor !== expected.amountMinor.toString()) {
    throw new DocumentValidationError(
      `Amount mismatch: invoice=${input.payload.amountMinor}, expected=${expected.amountMinor.toString()}`,
    );
  }
}

export function createInvoiceDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<InvoiceInput, InvoiceInput> {
  return {
    moduleId: "invoice",
    accountingSourceIds: [
      ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ACCOUNTING_SOURCE_ID.INVOICE_INVENTORY_FINALIZE,
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
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        amount: input.amount,
        amountMinor: input.amountMinor,
        counterpartyId: input.counterpartyId,
        currency: input.currency,
        customerId: input.customerId,
        invoicePurpose: input.invoicePurpose,
        billingSetRef: input.billingSetRef,
        quoteComponentIds: input.quoteComponentIds ?? [],
        memo: input.memo,
        organizationId: input.organizationId,
        organizationRequisiteId: input.organizationRequisiteId,
      });
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
    deriveSummary(document) {
      const payload = parseInvoicePayload(document);

      return {
        title: getInvoiceTitleByPurpose(payload),
        amountMinor: BigInt(getInvoiceAmountMinor(payload)),
        currency: getInvoiceCurrency(payload),
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId,
        customerId: payload.customerId,
        organizationRequisiteId: payload.organizationRequisiteId,
        searchText: [
          document.docNo,
          document.docType,
          payload.customerId,
          payload.counterpartyId,
          getInvoiceCurrency(payload),
        ]
          .filter(Boolean)
          .join(" "),
      };
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

      if (
        input.organizationId &&
        input.organizationId !== binding.organizationId
      ) {
        throw new DocumentValidationError(
          "organizationId does not match selected organization requisite",
        );
      }

      if (binding.currencyCode !== input.currency) {
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
      const dealFxContext = await resolveInvoiceDealFxContext(
        deps,
        document.id,
      );

      if (dealFxContext?.hasConvertLeg) {
        assertDealLinkedInvoiceMatchesCalculation({
          dealFxContext,
          payload,
        });
      } else if (getInvoicePurpose(payload) !== "combined") {
        throw new DocumentValidationError(
          "split invoice purpose requires an invoice linked to an FX deal",
        );
      }

      const expectedCurrency =
        dealFxContext?.hasConvertLeg && dealFxContext.calculationCurrency
          ? dealFxContext.calculationCurrency
          : getInvoiceCurrency(payload);

      if (binding.currencyCode !== expectedCurrency) {
        throw new DocumentValidationError(
          `Currency mismatch: invoice=${expectedCurrency}, account=${binding.currencyCode}`,
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
      const dealFxContext = await resolveInvoiceDealFxContext(
        deps,
        document.id,
      );

      if (dealFxContext?.hasConvertLeg) {
        assertDealLinkedInvoiceMatchesCalculation({
          dealFxContext,
          payload,
        });

        if (
          dealFxContext.fundingResolution.state !== "resolved" ||
          !dealFxContext.fundingResolution.strategy
        ) {
          throw new DocumentValidationError(
            "linked FX deal does not have a resolved funding strategy",
          );
        }

        if (dealFxContext.fundingResolution.strategy === "existing_inventory") {
          return buildInventoryFundedInvoicePostingPlan({
            deps,
            dealFxContext,
            context,
            document,
            payload,
            bookId: binding.bookId,
          });
        }

        return buildDealLinkedInvoicePostingPlan({
          deps,
          dealFxContext,
          context,
          document,
          payload,
          bookId: binding.bookId,
        });
      }

      if (getInvoicePurpose(payload) !== "combined") {
        throw new DocumentValidationError(
          "split invoice purpose requires an invoice linked to an FX deal",
        );
      }

      return buildDirectInvoicePostingPlan({
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    async resolveAccountingSourceId(_context, document) {
      const dealFxContext = await resolveInvoiceDealFxContext(
        deps,
        document.id,
      );

      if (dealFxContext?.hasConvertLeg) {
        if (
          dealFxContext.fundingResolution.state !== "resolved" ||
          !dealFxContext.fundingResolution.strategy
        ) {
          throw new DocumentValidationError(
            "linked FX deal does not have a resolved funding strategy",
          );
        }

        if (dealFxContext.fundingResolution.strategy === "existing_inventory") {
          return ACCOUNTING_SOURCE_ID.INVOICE_INVENTORY_FINALIZE;
        }

        return ACCOUNTING_SOURCE_ID.INVOICE_RESERVE;
      }

      return ACCOUNTING_SOURCE_ID.INVOICE_DIRECT;
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
