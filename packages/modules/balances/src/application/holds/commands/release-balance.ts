import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
} from "../../../errors";
import {
  validateReleaseBalanceInput,
  type ReleaseBalanceInput,
} from "../../../contracts";
import { DomainError, readCauseString } from "@bedrock/shared/core/domain";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
import { BalanceState } from "../../../domain/balance-state";
import { toBalanceHoldSnapshot } from "../../../domain/balance-hold";
import type { BalancesContext } from "../../shared/context";

export function createReleaseBalanceHandler(context: BalancesContext) {
  return async function release(input: ReleaseBalanceInput) {
    const validated = validateReleaseBalanceInput(input);

    return context.db.transaction((tx) =>
      context.idempotency.withIdempotencyTx({
        tx,
        scope: BALANCES_IDEMPOTENCY_SCOPE.RELEASE,
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
          const hold = await repository.getHoldForUpdate(
            validated.subject,
            validated.holdRef,
          );
          const state = BalanceState.reconstitute({
            balance: position,
            holds: hold ? [hold] : [],
          });

          let plan;
          try {
            plan = state.release({
              holdRef: validated.holdRef,
              reason: validated.reason,
              actorId: validated.actorId,
              requestContext: validated.requestContext,
              now: new Date(),
            });
          } catch (error) {
            if (error instanceof DomainError) {
              if (error.code === "balances.hold.not_found") {
                throw new BalanceHoldNotFoundError(validated.holdRef);
              }

              if (error.code === "balances.hold.invalid_state") {
                throw new BalanceHoldStateError(
                  validated.holdRef,
                  readCauseString(error, "state") ?? "unknown",
                  readCauseString(error, "action") ?? "release",
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

          if (plan.kind !== "update") {
            throw new Error(`Unexpected balance release plan: ${plan.kind}`);
          }

          const updatedPosition = await repository.updateBalancePosition({
            subject: validated.subject,
            delta: plan.delta,
          });
          const updatedHold = await repository.updateHold(
            plan.holdId,
            plan.holdUpdate,
          );

          await repository.appendBalanceEvent({
            subject: validated.subject,
            version: updatedPosition.version,
            ...plan.event,
          });

          return {
            balance: updatedPosition,
            hold: toBalanceHoldSnapshot(updatedHold),
          };
        },
      }),
    );
  };
}
