import { BalanceSubjectSchema, ReserveBalanceInputSchema } from "../../contracts";
import type { ReserveBalanceInput } from "../../contracts";
import { normalizeBalanceEventRequestContext } from "../../domain/balance-events";
import { toBalanceHoldSnapshot } from "../../domain/balance-hold";
import { BalanceState } from "../../domain/balance-state";
import { BALANCES_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import {
  BalanceHoldConflictError,
  InsufficientAvailableBalanceError,
} from "../../errors";
import type { BalancesCommandUnitOfWork } from "../ports/balances.uow";

export class ReserveBalanceCommand {
  constructor(private readonly unitOfWork: BalancesCommandUnitOfWork) {}

  execute(input: ReserveBalanceInput) {
    const validated = ReserveBalanceInputSchema.parse(input);
    const actorId = validated.actorId ?? null;
    const requestContext = normalizeBalanceEventRequestContext(
      validated.requestContext,
    );

    return this.unitOfWork.run(async (tx) =>
      tx.idempotency.withIdempotency({
        scope: BALANCES_IDEMPOTENCY_SCOPE.RESERVE,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          tx.stateRepository.loadMutationReplayResult(
            BalanceSubjectSchema.parse(validated.subject),
            validated.holdRef,
          ),
        handler: async () => {
          const position = await tx.stateRepository.ensureBalancePosition(
            validated.subject,
          );
          const existingHold = await tx.stateRepository.getHoldForUpdate(
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
              actorId,
              amountMinor: validated.amountMinor,
              holdRef: validated.holdRef,
              reason: validated.reason ?? null,
              requestContext,
            });
          } catch (error) {
            if (
              error instanceof Error &&
              "code" in error &&
              (error as { code: string }).code === "balances.hold.conflict"
            ) {
              throw new BalanceHoldConflictError(validated.holdRef);
            }

            if (
              error instanceof Error &&
              "code" in error &&
              (error as { code: string }).code ===
                "balances.insufficient_available"
            ) {
              throw new InsufficientAvailableBalanceError(
                position.available,
                validated.amountMinor,
              );
            }

            throw error;
          }

          if (plan.kind === "replay") {
            return tx.stateRepository.loadMutationReplayResult(
              validated.subject,
              validated.holdRef,
            );
          }

          if (plan.kind !== "reserve") {
            throw new Error(`Unexpected balance reserve plan: ${plan.kind}`);
          }

          const updatedPosition =
            await tx.stateRepository.updateBalancePosition({
              delta: plan.delta,
              subject: validated.subject,
            });
          const hold = await tx.stateRepository.createHold(plan.hold);

          await tx.stateRepository.appendBalanceEvent({
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
  }
}
