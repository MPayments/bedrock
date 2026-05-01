import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { Counterparty, Customer } from "@bedrock/parties/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import type {
  PaymentStep,
  QuoteExecution,
} from "@bedrock/treasury/contracts";

import { deriveFinanceDealReadiness } from "../close-readiness";
import type {
  CrmDealCustomerContext,
  CrmDealWorkbenchProjection,
} from "../contracts";
import type {
  DealAttachmentRecord,
  DealProjectionsWorkflowDeps,
} from "../shared/deps";
import {
  buildCrmDocumentRequirements,
  buildCrmEvidenceRequirements,
  buildDealInvoiceBillingSplit,
  buildCrmWorkbenchActions,
  serializeCrmPricingQuote,
} from "../shared/projection-builders";
import {
  getApplicantParticipant,
  getCustomerParticipant,
  getInternalEntityParticipant,
  isDealInTerminalStatus,
  isQuoteEligible,
} from "../shared/workflow-helpers";

function countCounterpartySnapshotFields(
  snapshot: DealWorkflowProjection["intake"]["externalBeneficiary"]["beneficiarySnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.country,
    snapshot.displayName,
    snapshot.inn,
    snapshot.legalName,
  ].filter((value) => Boolean(value)).length;
}

function countBankInstructionFields(
  snapshot: DealWorkflowProjection["intake"]["externalBeneficiary"]["bankInstructionSnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.accountNo,
    snapshot.bankAddress,
    snapshot.bankCountry,
    snapshot.bankName,
    snapshot.beneficiaryName,
    snapshot.bic,
    snapshot.iban,
    snapshot.label,
    snapshot.swift,
  ].filter((value) => Boolean(value)).length;
}

function buildCrmBeneficiaryDraft(input: {
  attachments: DealAttachmentRecord[];
  workflow: DealWorkflowProjection;
}) {
  if (input.workflow.intake.externalBeneficiary.beneficiaryCounterpartyId) {
    return null;
  }

  const attachmentById = new Map(
    input.attachments.map((attachment) => [attachment.id, attachment]),
  );
  const candidate = [...input.workflow.attachmentIngestions]
    .filter(
      (ingestion) =>
        ingestion.status === "processed" &&
        (ingestion.normalizedPayload?.beneficiarySnapshot ||
          ingestion.normalizedPayload?.bankInstructionSnapshot),
    )
    .sort((left, right) => {
      const leftAttachment = attachmentById.get(left.fileAssetId);
      const rightAttachment = attachmentById.get(right.fileAssetId);
      const leftRank = leftAttachment?.purpose === "invoice" ? 0 : 1;
      const rightRank = rightAttachment?.purpose === "invoice" ? 0 : 1;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftTime = left.lastProcessedAt?.getTime() ?? 0;
      const rightTime = right.lastProcessedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

  if (!candidate?.normalizedPayload) {
    return null;
  }

  return {
    bankInstructionSnapshot:
      candidate.normalizedPayload.bankInstructionSnapshot,
    beneficiarySnapshot: candidate.normalizedPayload.beneficiarySnapshot,
    fieldPresence: {
      bankInstructionFields: countBankInstructionFields(
        candidate.normalizedPayload.bankInstructionSnapshot,
      ),
      beneficiaryFields: countCounterpartySnapshotFields(
        candidate.normalizedPayload.beneficiarySnapshot,
      ),
    },
    purpose: attachmentById.get(candidate.fileAssetId)?.purpose ?? null,
    sourceAttachmentId: candidate.fileAssetId,
  };
}

function buildCrmWorkbenchEditability(workflow: DealWorkflowProjection) {
  return {
    agreement: workflow.summary.status === "draft",
    assignee: true,
    intake: !isDealInTerminalStatus(workflow),
  };
}

function replaceDoneTransitionReadiness(input: {
  closeReadiness: ReturnType<typeof deriveFinanceDealReadiness>["closeReadiness"];
  workflow: DealWorkflowProjection;
}): DealWorkflowProjection["transitionReadiness"] {
  return input.workflow.transitionReadiness.map((readiness) => {
    if (readiness.targetStatus !== "done") {
      return readiness;
    }

    return {
      allowed: input.closeReadiness.ready,
      blockers: input.closeReadiness.blockers.map((message) => ({
        code: "execution_leg_not_done",
        message,
        meta: {
          source: "finance_close_readiness",
        },
      })),
      targetStatus: "done",
    };
  });
}

function toCrmDealCustomerContext(
  customer: Customer,
  counterparties: Counterparty[],
): CrmDealCustomerContext {
  return {
    counterparties,
    customer,
  };
}

type CrmWorkbenchDeps = Pick<
  DealProjectionsWorkflowDeps,
  | "agreements"
  | "calculations"
  | "deals"
  | "files"
  | "parties"
  | "reconciliation"
  | "treasury"
>;

export async function getCrmDealWorkbenchProjection(
  deps: CrmWorkbenchDeps,
  dealId: string,
): Promise<CrmDealWorkbenchProjection | null> {
  const [detail, workflow, attachments] = await Promise.all([
    deps.deals.deals.queries.findById(dealId),
    deps.deals.deals.queries.findWorkflowById(dealId),
    deps.files.files.queries.listDealAttachments(dealId),
  ]);

  if (!detail || !workflow) {
    return null;
  }

  const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
  const applicantCounterpartyId =
    getApplicantParticipant(workflow)?.counterpartyId ??
    workflow.intake.common.applicantCounterpartyId;
  const internalEntityOrganizationId =
    getInternalEntityParticipant(workflow)?.organizationId ?? null;

  const [
    agreement,
    applicant,
    calculationsHistory,
    customer,
    internalEntity,
    pricingContext,
  ] = await Promise.all([
    deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
    applicantCounterpartyId
      ? deps.parties.counterparties.queries.findById(applicantCounterpartyId)
      : Promise.resolve(null),
    deps.deals.deals.queries.listCalculationHistory(dealId),
    customerId
      ? deps.parties.customers.queries.findById(customerId)
      : Promise.resolve(null),
    internalEntityOrganizationId
      ? deps.parties.organizations.queries.findById(
          internalEntityOrganizationId,
        )
      : Promise.resolve(null),
    deps.deals.deals.queries.findPricingContextByDealId({ dealId }),
  ]);

  const [
    acceptedQuoteDetailsRecord,
    legalEntitiesResult,
    currentCalculation,
    internalEntityRequisite,
    paymentStepsResult,
    quotesResult,
    quoteExecutionsResult,
  ] = await Promise.all([
    workflow.acceptedQuote?.quoteId
      ? deps.treasury.quotes.queries
          .getQuoteDetails({
            quoteRef: workflow.acceptedQuote.quoteId,
          })
          .catch(() => null)
      : Promise.resolve(null),
    customerId
      ? (async () => {
          const result = await deps.parties.counterparties.queries.list({
            customerId,
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          const data = (
            await Promise.all(
              result.data.map((item) =>
                deps.parties.counterparties.queries.findById(item.id),
              ),
            )
          ).filter((item): item is Counterparty => item !== null);

          return { ...result, data };
        })()
      : Promise.resolve(null),
    workflow.summary.calculationId
      ? deps.calculations.calculations.queries.findById(
          workflow.summary.calculationId,
        )
      : Promise.resolve(null),
    agreement?.organizationRequisiteId
      ? deps.parties.requisites.queries.findById(
          agreement.organizationRequisiteId,
        )
      : Promise.resolve(null),
    deps.treasury.paymentSteps.queries.list({
      dealId,
      limit: 100,
      offset: 0,
      purpose: "deal_leg",
    }),
    deps.treasury.quotes.queries.listQuotes({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    deps.treasury.quoteExecutions.queries.list({
      dealId,
      limit: 100,
      offset: 0,
    }),
  ]);

  const internalEntityRequisiteProvider = internalEntityRequisite?.providerId
    ? await deps.parties.requisites.queries.findProviderById(
        internalEntityRequisite.providerId,
      )
    : null;
  const paymentStepByPlanLegId = new Map<string, PaymentStep>();
  for (const step of paymentStepsResult.data) {
    if (
      step.origin.type === "deal_execution_leg" &&
      step.origin.planLegId !== null
    ) {
      paymentStepByPlanLegId.set(step.origin.planLegId, step);
    }
  }
  const quoteExecutionByPlanLegId = new Map<string, QuoteExecution>();
  for (const execution of quoteExecutionsResult.data) {
    if (
      execution.origin.type === "deal_execution_leg" &&
      execution.origin.planLegId !== null
    ) {
      quoteExecutionByPlanLegId.set(execution.origin.planLegId, execution);
    }
  }
  const reconciliationLinks =
    paymentStepsResult.data.length > 0
      ? await deps.reconciliation.links.listOperationLinks({
          operationIds: paymentStepsResult.data.map((step) => step.id),
        })
      : [];
  const reconciliationLinksByStepId = new Map(
    reconciliationLinks.map(
      (link): readonly [string, ReconciliationOperationLinkDto] => [
        link.operationId,
        link,
      ],
    ),
  );
  const { closeReadiness } = deriveFinanceDealReadiness({
    paymentStepByPlanLegId,
    quoteExecutionByPlanLegId,
    reconciliationLinksByStepId,
    workflow,
  });
  const transitionReadiness = replaceDoneTransitionReadiness({
    closeReadiness,
    workflow,
  });
  const workflowWithCloseReadiness = {
    ...workflow,
    transitionReadiness,
  };

  const actions = buildCrmWorkbenchActions(workflow);
  const editability = buildCrmWorkbenchEditability(workflow);
  const evidenceRequirements = buildCrmEvidenceRequirements({
    attachments,
    workflow,
  });
  const beneficiaryDraft = buildCrmBeneficiaryDraft({
    attachments,
    workflow,
  });
  const feeBillingMode =
    pricingContext.commercialDraft.feeBillingMode ??
    agreement?.currentVersion.feeBillingMode ??
    "included_in_principal_invoice";
  const billingSplit = buildDealInvoiceBillingSplit({
    dealId,
    feeBillingMode,
    quoteDetails: acceptedQuoteDetailsRecord,
  });
  const documentRequirements = buildCrmDocumentRequirements(workflow, {
    feeBillingMode,
    paymentSteps: paymentStepsResult.data,
  });

  return {
    acceptedQuote: workflow.acceptedQuote,
    actions,
    approvals: detail.approvals,
    assignee: {
      userId: workflow.summary.agentId,
    },
    beneficiaryDraft,
    comment: detail.comment,
    context: {
      agreement,
      applicant,
      customer:
        customer && legalEntitiesResult
          ? toCrmDealCustomerContext(customer, legalEntitiesResult.data)
          : null,
      internalEntity,
      internalEntityRequisite,
      internalEntityRequisiteProvider,
    },
    documentRequirements,
    editability,
    evidenceRequirements,
    executionPlan: workflow.executionPlan,
    intake: workflow.intake,
    nextAction: workflow.nextAction,
    operationalState: workflow.operationalState,
    participants: workflow.participants,
    pricing: {
      billingSplit,
      calculationHistory: calculationsHistory,
      context: pricingContext,
      currentCalculation,
      quoteEligibility: isQuoteEligible(workflow),
      quotes: quotesResult.data.map(serializeCrmPricingQuote),
    },
    relatedResources: {
      attachments,
      formalDocuments: workflow.relatedResources.formalDocuments,
      quoteExecutions: quoteExecutionsResult.data.map((execution) => ({
        id: execution.id,
        origin: execution.origin,
        quoteId: execution.quoteId,
        state: execution.state,
        updatedAt: execution.updatedAt.toISOString(),
      })),
    },
    sectionCompleteness: workflow.sectionCompleteness,
    summary: {
      ...workflow.summary,
      applicantDisplayName:
        getApplicantParticipant(workflow)?.displayName ?? null,
      customerDisplayName: customer?.name ?? null,
      internalEntityDisplayName:
        getInternalEntityParticipant(workflow)?.displayName ??
        internalEntity?.shortName ??
        null,
    },
    timeline: workflow.timeline,
    transitionReadiness,
    workflow: workflowWithCloseReadiness,
  };
}
