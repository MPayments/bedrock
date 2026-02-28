import { createExternalFundingHandler } from "./commands/external-funding";
import { createExecuteFxHandler } from "./commands/execute-fx";
import { createFeePaymentHandlers } from "./commands/fee-payment";
import { createFundingSettledHandler } from "./commands/funding";
import { createPayoutHandlers } from "./commands/payout";
import { createTreasuryContext, type TreasuryServiceDeps } from "./internal/context";

export type TreasuryService = ReturnType<typeof createTreasuryService>;

export function createTreasuryService(deps: TreasuryServiceDeps) {
  const context = createTreasuryContext(deps);

  const fundingSettled = createFundingSettledHandler(context);
  const externalFunding = createExternalFundingHandler(context);
  const executeFx = createExecuteFxHandler(context);
  const payoutHandlers = createPayoutHandlers(context);
  const feePaymentHandlers = createFeePaymentHandlers(context);

  return {
    fundingSettled,
    externalFunding,
    executeFx,
    ...payoutHandlers,
    ...feePaymentHandlers,
  };
}
