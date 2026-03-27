import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { FindOperationByIdempotencyKeyQuery } from "./queries/find-operation-by-idempotency-key";

export function createTreasuryControlsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);
  const findOperationByIdempotencyKey = new FindOperationByIdempotencyKeyQuery(
    context,
  );

  return {
    queries: {
      findOperationByIdempotencyKey:
        findOperationByIdempotencyKey.execute.bind(
          findOperationByIdempotencyKey,
        ),
    },
  };
}

export type TreasuryControlsService = ReturnType<
  typeof createTreasuryControlsService
>;
