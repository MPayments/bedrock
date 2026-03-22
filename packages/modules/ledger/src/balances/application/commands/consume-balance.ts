import {
  DomainError,
  invariant,
  readCauseString,
} from "@bedrock/shared/core/domain";

import type { ConsumeBalanceInput } from "../../contracts";
import { ConsumeBalanceInputSchema } from "../../contracts";
import { normalizeBalanceEventRequestContext } from "../../domain/balance-events";
import { toBalanceHoldSnapshot } from "../../domain/balance-hold";
import { BalanceState } from "../../domain/balance-state";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
} from "../../errors";
import type { BalancesCommandUnitOfWork } from "../ports/balances.uow";

export class ConsumeBalanceCommand {
  constructor(private readonly unitOfWork: BalancesCommandUnitOfWork) {}

  execute(input: ConsumeBalanceInput) {
    const validated = ConsumeBalanceInputSchema.parse(input);
    const actorId = validated.actorId ?? null;
    const requestContext = normalizeBalanceEventRequestContext(
      validated.requestContext,
    );

    return this.unitOfWork.run(async (tx) =>
      tx.idempotency.withIdempotency({
        scope: BALANCES_IDEMPOTENCY_SCOPE.CONSUME,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          tx.stateRepository.loadMutationReplayResult(
            validated.subject,
            validated.holdRef,
          ),
        handler: async () => {
          const position = await tx.stateRepository.ensureBalancePosition(
            validated.subject,
          );
          const hold = await tx.stateRepository.getHoldForUpdate(
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
              actorId,
              holdRef: validated.holdRef,
              now: new Date(),
              reason: validated.reason ?? null,
              requestContext,
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
            return tx.stateRepository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          invariant(
            plan.kind === "update",
            `Unexpected balance consume plan: ${plan.kind}`,
          );

          const updatedPosition =
            await tx.stateRepository.updateBalancePosition({
              delta: plan.delta,
              subject: validated.subject,
            });
          const updatedHold = await tx.stateRepository.updateHold(
            plan.holdId,
            plan.holdUpdate,
          );

          await tx.stateRepository.appendBalanceEvent({
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
  }
}
