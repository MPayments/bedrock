import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";
import { minorToAmountString } from "@bedrock/shared/money";

import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";

function resolveAcceptedQuoteCustomerTotal(
  workbench: ApiCrmDealWorkbenchProjection,
): { amountMinor: string; currency: string } | null {
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
    resolveAcceptedQuoteCustomerTotal(workbench);
  const currency = acceptedQuoteCustomerTotal?.currency ?? null;
  const amountMinor = acceptedQuoteCustomerTotal?.amountMinor ?? null;
  const amount =
    amountMinor && currency
      ? minorToAmountString(amountMinor, { currency })
      : null;

  return {
    ...(amount && currency ? { amount, currency } : {}),
    counterpartyId,
    customerId,
    organizationId,
    organizationRequisiteId,
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}

function buildAcceptancePrefill(
  workbench: ApiCrmDealWorkbenchProjection,
): Record<string, unknown> {
  return {
    counterpartyId:
      workbench.context.applicant?.id ??
      workbench.intake.common.applicantCounterpartyId ??
      null,
    customerId: workbench.context.customer?.customer.id ?? null,
    organizationId: workbench.context.internalEntity?.id ?? null,
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}

function buildExchangePrefill(
  workbench: ApiCrmDealWorkbenchProjection,
): Record<string, unknown> {
  return {
    occurredAt: new Date().toISOString().slice(0, 16),
    organizationId: workbench.context.internalEntity?.id ?? null,
  };
}

export function buildCrmDealDocumentInitialPayload(
  workbench: ApiCrmDealWorkbenchProjection,
  docType: string,
  _options: Pick<DocumentFormOptions, "currencies">,
): Record<string, unknown> | undefined {
  switch (docType) {
    case "invoice":
      return buildInvoicePrefill(workbench);
    case "acceptance":
      return buildAcceptancePrefill(workbench);
    case "exchange":
      return buildExchangePrefill(workbench);
    default:
      return undefined;
  }
}
