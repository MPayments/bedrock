import { buildProjectedBalanceDeltas } from "../../../domain/projection";
import type { BalancesWorkerContext } from "../../shared/context";

export function createRunProjectorPassHandler(input: {
  context: BalancesWorkerContext;
  batchSize?: number;
  beforeOperation?: Parameters<typeof createBeforeOperationGuardProxy>[0];
}) {
  const batchSize = input.batchSize ?? 100;
  const beforeOperation = createBeforeOperationGuardProxy(input.beforeOperation);

  return async function runProjectorPass() {
    return input.context.db.transaction(async (tx) => {
      const projection = input.context.createProjectionRepository(tx);
      const cursor = await projection.ensureCursor();
      const operations = await projection.listOperationsAfterCursor(
        cursor,
        batchSize,
      );
      let processed = 0;

      for (const operation of operations) {
        const postingRows = await projection.listProjectionPostingRows(operation);
        const bookIds = [...new Set(postingRows.map((row) => row.bookId))];

        if (
          !(await beforeOperation({
            operationId: operation.id,
            sourceType: operation.sourceType,
            sourceId: operation.sourceId,
            operationCode: operation.operationCode,
            bookIds,
          }))
        ) {
          break;
        }

        const deltas = buildProjectedBalanceDeltas(postingRows);
        for (const delta of deltas) {
          await projection.applyProjectedDelta({
            ...delta,
            operationId: operation.id,
            sourceType: operation.sourceType,
            sourceId: operation.sourceId,
            operationCode: operation.operationCode,
            postedAt: operation.postedAt,
          });
        }

        await projection.advanceCursor({
          postedAt: operation.postedAt,
          operationId: operation.id,
        });
        processed += 1;
      }

      if (processed > 0) {
        input.context.log.info("Projected ledger operations into balances", {
          processed,
          lastOperationId: operations[operations.length - 1]?.id ?? null,
        });
      }

      return processed;
    });
  };
}

function createBeforeOperationGuardProxy(
  guard:
    | ((
        input: {
          operationId: string;
          sourceType: string;
          sourceId: string;
          operationCode: string;
          bookIds: string[];
        },
      ) => Promise<boolean> | boolean)
    | undefined,
) {
  if (!guard) {
    return async () => true;
  }

  return async (input: {
    operationId: string;
    sourceType: string;
    sourceId: string;
    operationCode: string;
    bookIds: string[];
  }) => guard(input);
}
