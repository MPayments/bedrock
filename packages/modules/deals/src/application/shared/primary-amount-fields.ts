import type { DealHeader } from "../contracts/dto";

export function getPrimaryDealAmountFields(header: DealHeader) {
  if (header.type === "payment") {
    return {
      amount: header.incomingReceipt.expectedAmount,
      currencyId:
        header.moneyRequest.targetCurrencyId ??
        header.incomingReceipt.expectedCurrencyId,
    };
  }

  return {
    amount: header.moneyRequest.sourceAmount,
    currencyId: header.moneyRequest.sourceCurrencyId,
  };
}
