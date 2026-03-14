import {
  BalanceHoldConflictError,
  InsufficientAvailableBalanceError,
} from "../../../errors";
import {
  validateReserveBalanceInput,
  type ReserveBalanceInput,
} from "../../../contracts";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../../domain/idempotency";
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

          if (existingHold) {
            if (existingHold.amountMinor !== validated.amountMinor) {
              throw new BalanceHoldConflictError(validated.holdRef);
            }

            return repository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          if (position.available < validated.amountMinor) {
            throw new InsufficientAvailableBalanceError(
              position.available,
              validated.amountMinor,
            );
          }

          const updatedPosition = await repository.updateBalancePosition({
            subject: validated.subject,
            delta: {
              deltaAvailable: -validated.amountMinor,
              deltaReserved: validated.amountMinor,
            },
          });
          const hold = await repository.createHold({
            subject: validated.subject,
            holdRef: validated.holdRef,
            amountMinor: validated.amountMinor,
            state: "active",
            reason: validated.reason ?? null,
            actorId: validated.actorId ?? null,
            requestContext: validated.requestContext,
          });

          await repository.appendBalanceEvent({
            subject: validated.subject,
            eventType: "reserve",
            version: updatedPosition.version,
            holdRef: validated.holdRef,
            deltaAvailable: -validated.amountMinor,
            deltaReserved: validated.amountMinor,
            actorId: validated.actorId,
            requestContext: validated.requestContext,
            meta: validated.reason ? { reason: validated.reason } : null,
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
