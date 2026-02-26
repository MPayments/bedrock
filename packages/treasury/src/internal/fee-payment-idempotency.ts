import { InvalidStateError } from "../errors";
import { type InitiateFeePaymentInput } from "../validation";

export function assertInitiateFeePaymentReplayCompatible(
  feeOrder: any,
  input: InitiateFeePaymentInput,
) {
  if (feeOrder.railRef !== input.railRef) {
    throw new InvalidStateError(
      `FeePaymentOrder already initiated with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`,
    );
  }
  if (
    feeOrder.payoutCounterpartyId &&
    feeOrder.payoutCounterpartyId !== input.payoutCounterpartyId
  ) {
    throw new InvalidStateError(
      `FeePaymentOrder already initiated with different payoutCounterpartyId (expected ${feeOrder.payoutCounterpartyId}, got ${input.payoutCounterpartyId})`,
    );
  }
  if (
    feeOrder.payoutOperationalAccountId &&
    feeOrder.payoutOperationalAccountId !== input.payoutOperationalAccountId
  ) {
    throw new InvalidStateError(
      `FeePaymentOrder already initiated with different payoutOperationalAccountId (expected ${feeOrder.payoutOperationalAccountId}, got ${input.payoutOperationalAccountId})`,
    );
  }
  const initiateOperationId = feeOrder.initiateOperationId ?? null;
  if (!initiateOperationId || !feeOrder.pendingTransferId) {
    throw new InvalidStateError(
      "FeePaymentOrder missing initiateOperationId/pendingTransferId",
    );
  }
}
