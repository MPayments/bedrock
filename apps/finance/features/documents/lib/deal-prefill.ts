import type { FinanceAgreementContext } from "@/features/agreements/lib/queries";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { minorToAmountString } from "@bedrock/shared/money";

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
  deal: Pick<FinanceDealWorkbench, "workflow">,
  role: DealWorkflowParticipantRole,
) {
  return deal.workflow?.participants.find((participant) => participant.role === role);
}

function getOpeningInvoiceDocumentId(
  deal: Pick<FinanceDealWorkbench, "formalDocumentRequirements">,
) {
  return (
    deal.formalDocumentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" && requirement.docType === "invoice",
    )?.activeDocumentId ?? null
  );
}

function getCalculationCurrencyCode(
  deal: Pick<FinanceDealWorkbench, "calculationHistory" | "summary">,
  options: Pick<DocumentFormOptions, "currencies">,
) {
  const calculation =
    (deal.summary.calculationId
      ? deal.calculationHistory.find(
          (item) => item.calculationId === deal.summary.calculationId,
        )
      : null) ?? deal.calculationHistory[0] ?? null;

  if (!calculation) {
    return null;
  }

  return (
    options.currencies.find(
      (currency) => currency.id === calculation.calculationCurrencyId,
    )?.code ?? null
  );
}

export function buildDealScopedDocumentInitialPayload(input: {
  agreement: FinanceAgreementContext | null;
  options: Pick<DocumentFormOptions, "currencies">;
  deal: Pick<
    FinanceDealWorkbench,
    "calculationHistory" | "formalDocumentRequirements" | "summary" | "workflow"
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
      const calculation =
        (input.deal.summary.calculationId
          ? input.deal.calculationHistory.find(
              (item) => item.calculationId === input.deal.summary.calculationId,
            )
          : null) ?? input.deal.calculationHistory[0] ?? null;
      const currency =
        getCalculationCurrencyCode(input.deal, input.options);
      const amount =
        calculation && currency
          ? minorToAmountString(calculation.totalAmountMinor, {
              currency,
            })
          : null;

      return compactPayload({
        amount,
        counterpartyId,
        currency,
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
