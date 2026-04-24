import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

export function getCustomerParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "customer",
  );
}

export function getApplicantParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "applicant",
  );
}

export function getInternalEntityParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "internal_entity",
  );
}

export function isDealInTerminalStatus(workflow: DealWorkflowProjection) {
  return (
    workflow.summary.status === "done" ||
    workflow.summary.status === "cancelled"
  );
}

export function isQuoteEligible(workflow: DealWorkflowProjection) {
  const sourceCurrencyId = workflow.intake.moneyRequest.sourceCurrencyId;
  const targetCurrencyId = workflow.intake.moneyRequest.targetCurrencyId;
  const requestedAmount =
    workflow.intake.type === "payment"
      ? workflow.intake.incomingReceipt?.expectedAmount
      : workflow.intake.moneyRequest.sourceAmount;

  return Boolean(
    sourceCurrencyId &&
      targetCurrencyId &&
      sourceCurrencyId !== targetCurrencyId &&
      requestedAmount,
  );
}

export function collectBlockingReasons(workflow: DealWorkflowProjection) {
  const messages = new Set<string>();

  for (const readiness of workflow.transitionReadiness) {
    for (const blocker of readiness.blockers) {
      messages.add(blocker.message);
    }
  }

  return Array.from(messages);
}
