import { InvalidStateError } from "../errors";
import { type InitiateFeePaymentInput } from "../validation";

export function assertInitiateFeePaymentReplayCompatible(feeOrder: any, input: InitiateFeePaymentInput) {
    if (feeOrder.railRef !== input.railRef) {
        throw new InvalidStateError(
            `FeePaymentOrder already initiated with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
        );
    }
    if (feeOrder.payoutOrgId && feeOrder.payoutOrgId !== input.payoutOrgId) {
        throw new InvalidStateError(
            `FeePaymentOrder already initiated with different payoutOrgId (expected ${feeOrder.payoutOrgId}, got ${input.payoutOrgId})`
        );
    }
    if (feeOrder.payoutBankStableKey && feeOrder.payoutBankStableKey !== input.payoutBankStableKey) {
        throw new InvalidStateError(
            `FeePaymentOrder already initiated with different payoutBankStableKey (expected ${feeOrder.payoutBankStableKey}, got ${input.payoutBankStableKey})`
        );
    }
    if (!feeOrder.initiateEntryId || !feeOrder.pendingTransferId) {
        throw new InvalidStateError("FeePaymentOrder missing initiateEntryId/pendingTransferId");
    }
}
