import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
} from "../../../errors";
import {
  validateReleaseBalanceInput,
  type ReleaseBalanceInput,
} from "../../../contracts";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
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
          const hold = await repository.getHoldForUpdate(
            validated.subject,
            validated.holdRef,
          );

          if (!hold) {
            throw new BalanceHoldNotFoundError(validated.holdRef);
          }

          if (hold.state === "released") {
            return repository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          if (hold.state !== "active") {
            throw new BalanceHoldStateError(
              validated.holdRef,
              hold.state,
              "release",
            );
          }

          await repository.ensureBalancePosition(validated.subject);
          const updatedPosition = await repository.updateBalancePosition({
            subject: validated.subject,
            delta: {
              deltaAvailable: hold.amountMinor,
              deltaReserved: -hold.amountMinor,
            },
          });
          const updatedHold = await repository.updateHold(hold.id, {
            state: "released",
            reason: validated.reason ?? hold.reason,
            actorId: validated.actorId ?? hold.actorId,
            releasedAt: new Date(),
          });

          await repository.appendBalanceEvent({
            subject: validated.subject,
            eventType: "release",
            version: updatedPosition.version,
            holdRef: validated.holdRef,
            deltaAvailable: hold.amountMinor,
            deltaReserved: -hold.amountMinor,
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
