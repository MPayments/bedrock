import {
  BalanceHoldConflictError,
  InsufficientAvailableBalanceError,
} from "../../../errors";
import {
  validateReserveBalanceInput,
  type ReserveBalanceInput,
} from "../../../contracts";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
import { BalanceState } from "../../../domain/balance-state";
import { toBalanceHoldSnapshot } from "../../../domain/balance-hold";
import type { BalancesContext } from "../../shared/context";

export function createReserveBalanceHandler(context: BalancesContext) {
  return async function reserve(input: ReserveBalanceInput) {
    const validated = validateReserveBalanceInput(input);

    return context.db.transaction((tx) =>
      context.idempotency.withIdempotencyTx({
        tx,
        scope: BALANCES_IDEMPOTENCY_SCOPE.RESERVE,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          context
            .createStateRepository(tx)
            .loadMutationReplayResult(validated.subject, validated.holdRef),
        handler: async () => {
          const repository = context.createStateRepository(tx);
          const position = await repository.ensureBalancePosition(validated.subject);
          const existingHold = await repository.getHoldForUpdate(
            validated.subject,
            validated.holdRef,
          );
          const state = BalanceState.reconstitute({
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
            return repository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          if (plan.kind !== "reserve") {
            throw new Error(`Unexpected balance reserve plan: ${plan.kind}`);
          }

          const updatedPosition = await repository.updateBalancePosition({
            subject: validated.subject,
            delta: plan.delta,
          });
          const hold = await repository.createHold(plan.hold);

          await repository.appendBalanceEvent({
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
