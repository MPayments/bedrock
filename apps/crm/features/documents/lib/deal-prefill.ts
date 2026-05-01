import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";
import { minorToAmountString } from "@bedrock/shared/money";

import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";

function resolveAcceptedQuoteCustomerTotal(
  workbench: ApiCrmDealWorkbenchProjection,
  invoicePurpose: "combined" | "principal" | "agency_fee" | null,
): { amountMinor: string; currency: string } | null {
  const billingSplit = workbench.pricing.billingSplit;
  if (billingSplit) {
    const splitAmount =
      invoicePurpose === "agency_fee"
        ? billingSplit.agencyFee
        : invoicePurpose === "principal"
          ? billingSplit.principal
          : billingSplit.principal;

    if (splitAmount) {
      return {
        amountMinor: splitAmount.amountMinor,
        currency: splitAmount.currency,
      };
    }
  }

  const quoteId = workbench.acceptedQuote?.quoteId ?? null;
  const quote = quoteId
    ? workbench.pricing.quotes.find((item) => item.id === quoteId)
    : null;
  const customerTotalMinor = quote?.profitability?.customerTotalMinor ?? null;
  const currency = quote?.profitability?.currency ?? quote?.fromCurrency ?? null;

  return customerTotalMinor && currency
    ? { amountMinor: customerTotalMinor, currency }
    : null;
}

function buildInvoicePrefill(
  workbench: ApiCrmDealWorkbenchProjection,
  invoicePurpose: "combined" | "principal" | "agency_fee" | null,
): Record<string, unknown> {
  const counterpartyId =
    workbench.context.applicant?.id ??
    workbench.intake.common.applicantCounterpartyId ??
    null;
  const customerId = workbench.context.customer?.customer.id ?? null;
  const organizationId = workbench.context.internalEntity?.id ?? null;
  const organizationRequisiteId =
    workbench.context.internalEntityRequisite?.id ?? null;
  const acceptedQuoteCustomerTotal =
    resolveAcceptedQuoteCustomerTotal(workbench, invoicePurpose);
  const currency = acceptedQuoteCustomerTotal?.currency ?? null;
  const amountMinor = acceptedQuoteCustomerTotal?.amountMinor ?? null;
  const amount =
    amountMinor && currency
      ? minorToAmountString(amountMinor, { currency })
      : null;

  return {
    ...(amount && currency ? { amount, currency } : {}),
    ...(invoicePurpose ? { invoicePurpose } : {}),
    ...(workbench.pricing.billingSplit?.billingSetRef
      ? { billingSetRef: workbench.pricing.billingSplit.billingSetRef }
      : {}),
    counterpartyId,
    customerId,
    organizationId,
    organizationRequisiteId,
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}

function buildApplicationPrefill(
  workbench: ApiCrmDealWorkbenchProjection,
): Record<string, unknown> {
  return {
    calculationId: workbench.summary.calculationId,
    counterpartyId:
      workbench.context.applicant?.id ??
      workbench.intake.common.applicantCounterpartyId ??
      null,
    customerId: workbench.context.customer?.customer.id ?? null,
    dealId: workbench.summary.id,
    organizationId: workbench.context.internalEntity?.id ?? null,
    organizationRequisiteId:
      workbench.context.internalEntityRequisite?.id ?? null,
    occurredAt: new Date().toISOString().slice(0, 16),
    quoteId: workbench.acceptedQuote?.quoteId ?? null,
  };
}

function buildAcceptancePrefill(
  workbench: ApiCrmDealWorkbenchProjection,
): Record<string, unknown> {
  const applicationDocumentId =
    workbench.documentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" &&
        requirement.docType === "application",
    )?.activeDocumentId ?? null;
  const principalInvoiceId =
    workbench.documentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" &&
        requirement.docType === "invoice" &&
        requirement.invoicePurpose !== "agency_fee",
    )?.activeDocumentId ?? null;

  return {
    applicationDocumentId,
    counterpartyId:
      workbench.context.applicant?.id ??
      workbench.intake.common.applicantCounterpartyId ??
      null,
    customerId: workbench.context.customer?.customer.id ?? null,
    invoiceDocumentId: principalInvoiceId,
    organizationId: workbench.context.internalEntity?.id ?? null,
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}

function buildExchangePrefill(
  workbench: ApiCrmDealWorkbenchProjection,
): Record<string, unknown> {
  const principalInvoiceId =
    workbench.documentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" &&
        requirement.docType === "invoice" &&
        requirement.invoicePurpose !== "agency_fee",
    )?.activeDocumentId ?? null;

  return {
    invoiceDocumentId: principalInvoiceId,
    occurredAt: new Date().toISOString().slice(0, 16),
    organizationId: workbench.context.internalEntity?.id ?? null,
  };
}

export function buildCrmDealDocumentInitialPayload(
  workbench: ApiCrmDealWorkbenchProjection,
  docType: string,
  options: Pick<DocumentFormOptions, "currencies">,
  input?: {
    invoicePurpose?: "combined" | "principal" | "agency_fee" | null;
  },
): Record<string, unknown> | undefined {
  void options;

  switch (docType) {
    case "application":
      return buildApplicationPrefill(workbench);
    case "invoice":
      return buildInvoicePrefill(workbench, input?.invoicePurpose ?? null);
    case "acceptance":
      return buildAcceptancePrefill(workbench);
    case "exchange":
      return buildExchangePrefill(workbench);
    default:
      return undefined;
  }
}
