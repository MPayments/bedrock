import { DomainError, readCauseString } from "@bedrock/shared/core/domain";

import {
  validateConsumeBalanceInput,
  type ConsumeBalanceInput,
} from "../../../contracts";
import { toBalanceHoldSnapshot } from "../../../domain/balance-hold";
import { BalanceState } from "../../../domain/balance-state";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
} from "../../../errors";
import type { BalancesContext } from "../../shared/context";

export function createConsumeBalanceHandler(context: BalancesContext) {
  return async function consume(input: ConsumeBalanceInput) {
    const validated = validateConsumeBalanceInput(input);

    return context.transactions.withTransaction(
      async ({ stateRepository, idempotency }) =>
        idempotency.withIdempotency({
          scope: BALANCES_IDEMPOTENCY_SCOPE.CONSUME,
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
            const hold = await stateRepository.getHoldForUpdate(
              validated.subject,
              validated.holdRef,
            );
            const state = BalanceState.fromSnapshot({
              balance: position,
              holds: hold ? [hold] : [],
            });

            let plan;
            try {
              plan = state.consume({
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
                    readCauseString(error, "action") ?? "consume",
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

            if (plan.kind !== "update") {
              throw new Error(`Unexpected balance consume plan: ${plan.kind}`);
            }

            const updatedPosition = await stateRepository.updateBalancePosition({
              subject: validated.subject,
              delta: plan.delta,
            });
            const updatedHold = await stateRepository.updateHold(
              plan.holdId,
              plan.holdUpdate,
            );

            await stateRepository.appendBalanceEvent({
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
