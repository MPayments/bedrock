import type { DealIntakeDraft } from "../contracts/dto";

export function getPrimaryDealAmountFields(intake: DealIntakeDraft) {
  if (intake.type === "payment") {
    return {
      amount: intake.incomingReceipt.expectedAmount,
      currencyId:
        intake.moneyRequest.targetCurrencyId ??
        intake.incomingReceipt.expectedCurrencyId,
    };
  }

  return {
    amount: intake.moneyRequest.sourceAmount,
    currencyId: intake.moneyRequest.sourceCurrencyId,
  };
}
