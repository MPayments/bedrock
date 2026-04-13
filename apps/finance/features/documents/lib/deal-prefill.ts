import type { FinanceAgreementContext } from "@/features/agreements/lib/queries";
import type { SerializedRequisite } from "@/features/entities/requisites-shared/lib/constants";
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

function getLatestTransferDocumentId(
  deal: Pick<FinanceDealWorkbench, "relatedResources">,
) {
  const transferDocuments = deal.relatedResources.formalDocuments
    .filter(
      (document) =>
        document.docType === "transfer_intercompany" ||
        document.docType === "transfer_intra",
    )
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightTime - leftTime;
    });

  return transferDocuments[0]?.id ?? null;
}

function getCalculationCurrencyCode(
  deal: Pick<FinanceDealWorkbench, "calculationHistory" | "summary">,
  options: Pick<DocumentFormOptions, "currencies">,
) {
  const calculation = getSelectedCalculation(deal);

  if (!calculation) {
    return null;
  }

  return (
    options.currencies.find(
      (currency) => currency.id === calculation.calculationCurrencyId,
    )?.code ?? null
  );
}

function getSelectedCalculation(
  deal: Pick<FinanceDealWorkbench, "calculationHistory" | "summary">,
) {
  return (
    (deal.summary.calculationId
      ? deal.calculationHistory.find(
          (item) => item.calculationId === deal.summary.calculationId,
        )
      : null) ?? deal.calculationHistory[0] ?? null
  );
}

function selectOrganizationRequisiteId(input: {
  agreementRequisiteId: string | null;
  calculationCurrencyId: string | null;
  organizationRequisites?: Pick<SerializedRequisite, "currencyId" | "id" | "isDefault">[];
}) {
  if (!input.organizationRequisites) {
    return input.agreementRequisiteId;
  }

  if (!input.calculationCurrencyId) {
    return input.agreementRequisiteId;
  }

  const sameCurrencyRequisites = input.organizationRequisites.filter(
    (requisite) => requisite.currencyId === input.calculationCurrencyId,
  );

  if (sameCurrencyRequisites.length === 0) {
    return null;
  }

  if (
    input.agreementRequisiteId &&
    sameCurrencyRequisites.some(
      (requisite) => requisite.id === input.agreementRequisiteId,
    )
  ) {
    return input.agreementRequisiteId;
  }

  return (
    sameCurrencyRequisites.find((requisite) => requisite.isDefault)?.id ??
    sameCurrencyRequisites[0]?.id ??
    null
  );
}

export function buildDealScopedDocumentInitialPayload(input: {
  agreement: FinanceAgreementContext | null;
  options: Pick<DocumentFormOptions, "currencies">;
  deal: Pick<
    FinanceDealWorkbench,
    | "calculationHistory"
    | "formalDocumentRequirements"
    | "relatedResources"
    | "summary"
    | "workflow"
  >;
  docType: string;
  organizationRequisites?: Pick<SerializedRequisite, "currencyId" | "id" | "isDefault">[];
  reconciliationExceptionId?: string | null;
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
      const calculation = getSelectedCalculation(input.deal);
      const currency =
        getCalculationCurrencyCode(input.deal, input.options);
      const amount =
        calculation && currency
          ? minorToAmountString(calculation.totalAmountMinor, {
              currency,
            })
          : null;
      const organizationRequisiteId = selectOrganizationRequisiteId({
        agreementRequisiteId: input.agreement?.organizationRequisiteId ?? null,
        calculationCurrencyId: calculation?.calculationCurrencyId ?? null,
        organizationRequisites: input.organizationRequisites,
      });

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

    case "transfer_resolution": {
      const initialPayload: Record<string, unknown> = {
        pendingIndex: 0,
      };
      const transferDocumentId = getLatestTransferDocumentId(input.deal);

      if (transferDocumentId) {
        initialPayload.transferDocumentId = transferDocumentId;
      }

      if (input.reconciliationExceptionId) {
        initialPayload.eventIdempotencyKey =
          `reconciliation:${input.reconciliationExceptionId}`;
      }

      return Object.keys(initialPayload).length > 0
        ? initialPayload
        : undefined;
    }

    default:
      return undefined;
  }
}
