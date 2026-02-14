import { createExecuteFxHandler } from "./commands/execute-fx";
import { createFeePaymentHandlers } from "./commands/fee-payment";
import { createFundingSettledHandler } from "./commands/funding";
import { createPayoutHandlers } from "./commands/payout";
import { createTreasuryContext, type TreasuryServiceDeps } from "./internal/context";

export type { TreasuryServiceDeps } from "./internal/context";

export function createTreasuryService(deps: TreasuryServiceDeps) {
    const context = createTreasuryContext(deps);

    const fundingSettled = createFundingSettledHandler(context);
    const executeFx = createExecuteFxHandler(context);
    const payoutHandlers = createPayoutHandlers(context);
    const feePaymentHandlers = createFeePaymentHandlers(context);

    return {
        keys: context.keys,
        fundingSettled,
        executeFx,
        ...payoutHandlers,
        ...feePaymentHandlers,
    }
}
