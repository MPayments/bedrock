import type { DealIntakeDraft } from "../contracts/dto";

export function applyCompatibilityRequestedFields(input: {
  draft: DealIntakeDraft;
  requestedAmount: string | null | undefined;
  requestedCurrencyId: string | null | undefined;
}) {
  const requestedAmount = input.requestedAmount ?? null;
  const requestedCurrencyId = input.requestedCurrencyId ?? null;

  if (input.draft.type === "payment") {
    input.draft.incomingReceipt.expectedAmount = requestedAmount;
    input.draft.incomingReceipt.expectedCurrencyId = requestedCurrencyId;
    input.draft.moneyRequest.targetCurrencyId = requestedCurrencyId;
    return;
  }

  input.draft.moneyRequest.sourceAmount = requestedAmount;
  input.draft.moneyRequest.sourceCurrencyId = requestedCurrencyId;
}

export function getCompatibilityRequestedFields(intake: DealIntakeDraft) {
  if (intake.type === "payment") {
    return {
      requestedAmount: intake.incomingReceipt.expectedAmount,
      requestedCurrencyId:
        intake.moneyRequest.targetCurrencyId ??
        intake.incomingReceipt.expectedCurrencyId,
    };
  }

  return {
    requestedAmount: intake.moneyRequest.sourceAmount,
    requestedCurrencyId: intake.moneyRequest.sourceCurrencyId,
  };
}
