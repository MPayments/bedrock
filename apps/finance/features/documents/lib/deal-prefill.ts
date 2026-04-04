import type { FinanceAgreementContext } from "@/features/agreements/lib/queries";
import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";

type DealWorkflowParticipantRole =
  | "applicant"
  | "customer"
  | "external_beneficiary"
  | "external_payer"
  | "internal_entity";

function compactPayload(
  payload: Record<string, string | null | undefined>,
): Record<string, unknown> | undefined {
  const entries = Object.entries(payload).filter((entry) => {
    const value = entry[1];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function getWorkflowParticipant(
  deal: Pick<FinanceDealWorkspace, "workflow">,
  role: DealWorkflowParticipantRole,
) {
  return deal.workflow?.participants.find((participant) => participant.role === role);
}

function getOpeningInvoiceDocumentId(
  deal: Pick<FinanceDealWorkspace, "formalDocumentRequirements">,
) {
  return (
    deal.formalDocumentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" && requirement.docType === "invoice",
    )?.activeDocumentId ?? null
  );
}

export function buildDealScopedDocumentInitialPayload(input: {
  agreement: FinanceAgreementContext | null;
  deal: Pick<
    FinanceDealWorkspace,
    "formalDocumentRequirements" | "workflow"
  >;
  docType: string;
}): Record<string, unknown> | undefined {
  switch (input.docType) {
    case "invoice": {
      const customerId =
        getWorkflowParticipant(input.deal, "customer")?.customerId ?? null;
      const counterpartyId =
        getWorkflowParticipant(input.deal, "applicant")?.counterpartyId ??
        input.deal.workflow?.intake.common.applicantCounterpartyId ??
        null;
      const organizationId =
        input.agreement?.organizationId ??
        getWorkflowParticipant(input.deal, "internal_entity")?.organizationId ??
        null;
      const organizationRequisiteId =
        input.agreement?.organizationRequisiteId ?? null;

      return compactPayload({
        counterpartyId,
        customerId,
        organizationId,
        organizationRequisiteId,
      });
    }

    case "acceptance":
    case "exchange": {
      return compactPayload({
        invoiceDocumentId: getOpeningInvoiceDocumentId(input.deal),
      });
    }

    default:
      return undefined;
  }
}
