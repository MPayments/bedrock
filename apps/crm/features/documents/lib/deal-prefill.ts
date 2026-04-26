import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";

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

  return {
    counterpartyId,
    customerId,
    organizationId,
    organizationRequisiteId,
    occurredAt: new Date().toISOString().slice(0, 16),
    financialLines: [],
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
