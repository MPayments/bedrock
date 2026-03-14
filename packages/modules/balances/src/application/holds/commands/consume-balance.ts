import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
} from "../../../errors";
import {
  validateConsumeBalanceInput,
  type ConsumeBalanceInput,
} from "../../../contracts";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
import { toBalanceHoldSnapshot } from "../../../domain/balance-hold";
import type { BalancesContext } from "../../shared/context";

export function createConsumeBalanceHandler(context: BalancesContext) {
  return async function consume(input: ConsumeBalanceInput) {
    const validated = validateConsumeBalanceInput(input);

    return context.db.transaction((tx) =>
      context.idempotency.withIdempotencyTx({
        tx,
        scope: BALANCES_IDEMPOTENCY_SCOPE.CONSUME,
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
          const hold = await repository.getHoldForUpdate(
            validated.subject,
            validated.holdRef,
          );

          if (!hold) {
            throw new BalanceHoldNotFoundError(validated.holdRef);
          }

          if (hold.state === "consumed") {
            return repository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          if (hold.state !== "active") {
            throw new BalanceHoldStateError(
              validated.holdRef,
              hold.state,
              "consume",
            );
          }

          await repository.ensureBalancePosition(validated.subject);
          const updatedPosition = await repository.updateBalancePosition({
            subject: validated.subject,
            delta: {
              deltaReserved: -hold.amountMinor,
              deltaPending: hold.amountMinor,
            },
          });
          const updatedHold = await repository.updateHold(hold.id, {
            state: "consumed",
            reason: validated.reason ?? hold.reason,
            actorId: validated.actorId ?? hold.actorId,
            consumedAt: new Date(),
          });

          await repository.appendBalanceEvent({
            subject: validated.subject,
            eventType: "consume",
            version: updatedPosition.version,
            holdRef: validated.holdRef,
            deltaReserved: -hold.amountMinor,
            deltaPending: hold.amountMinor,
            actorId: validated.actorId,
            requestContext: validated.requestContext,
            meta: validated.reason ? { reason: validated.reason } : null,
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
