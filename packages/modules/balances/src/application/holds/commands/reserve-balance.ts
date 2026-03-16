import {
  validateReserveBalanceInput,
  type ReserveBalanceInput,
} from "../../../contracts";
import { toBalanceHoldSnapshot } from "../../../domain/balance-hold";
import { BalanceState } from "../../../domain/balance-state";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
import {
  BalanceHoldConflictError,
  InsufficientAvailableBalanceError,
} from "../../../errors";
import type { BalancesContext } from "../../shared/context";

export function createReserveBalanceHandler(context: BalancesContext) {
  return async function reserve(input: ReserveBalanceInput) {
    const validated = validateReserveBalanceInput(input);

    return context.transactions.withTransaction(
      async ({ stateRepository, idempotency }) =>
        idempotency.withIdempotency({
          scope: BALANCES_IDEMPOTENCY_SCOPE.RESERVE,
          idempotencyKey: input.idempotencyKey,
          request: validated,
          actorId: validated.actorId,
          serializeResult: () => ({
            holdRef: validated.holdRef,
            subject: validated.subject,
          }),
          loadReplayResult: async () =>
            stateRepository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            ),
          handler: async () => {
            const position = await stateRepository.ensureBalancePosition(
              validated.subject,
            );
            const existingHold = await stateRepository.getHoldForUpdate(
              validated.subject,
              validated.holdRef,
            );
            const state = BalanceState.fromSnapshot({
              balance: position,
              holds: existingHold ? [existingHold] : [],
            });

            let plan;
            try {
              plan = state.reserve({
                holdRef: validated.holdRef,
                amountMinor: validated.amountMinor,
                reason: validated.reason,
                actorId: validated.actorId,
                requestContext: validated.requestContext,
              });
            } catch (error) {
              if (error instanceof Error && "code" in error) {
                if ((error as { code: string }).code === "balances.hold.conflict") {
                  throw new BalanceHoldConflictError(validated.holdRef);
                }

                if (
                  (error as { code: string }).code ===
                  "balances.insufficient_available"
                ) {
                  throw new InsufficientAvailableBalanceError(
                    position.available,
                    validated.amountMinor,
                  );
                }
              }

              throw error;
            }

            if (plan.kind === "replay") {
              return stateRepository.loadMutationReplayResult(
                validated.subject,
                validated.holdRef,
              );
            }

            if (plan.kind !== "reserve") {
              throw new Error(`Unexpected balance reserve plan: ${plan.kind}`);
            }

            const updatedPosition = await stateRepository.updateBalancePosition({
              subject: validated.subject,
              delta: plan.delta,
            });
            const hold = await stateRepository.createHold(plan.hold);

            await stateRepository.appendBalanceEvent({
              subject: validated.subject,
              version: updatedPosition.version,
              ...plan.event,
            });

            return {
              balance: updatedPosition,
              hold: toBalanceHoldSnapshot(hold),
            };
          },
        }),
    );
  };
}
