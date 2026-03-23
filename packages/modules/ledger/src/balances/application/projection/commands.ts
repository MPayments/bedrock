import { buildProjectedBalanceDeltas } from "../../domain/projection";
import type { BalancesWorkerContext } from "../shared/context";

type BeforeOperationGuard = (input: {
  operationId: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  bookIds: string[];
}) => Promise<boolean> | boolean;

export class RunProjectorPassCommand {
  private readonly batchSize: number;

  constructor(
    private readonly context: BalancesWorkerContext,
    input?: {
      batchSize?: number;
      beforeOperation?: BeforeOperationGuard;
    },
  ) {
    this.batchSize = input?.batchSize ?? 100;
    this.beforeOperation = this.createBeforeOperationGuardProxy(
      input?.beforeOperation,
    );
  }

  private readonly beforeOperation: BeforeOperationGuard = async () => true;

  async execute() {
    return this.context.transactions.withTransaction(
      async ({ projectionRepository: projection }) => {
        const cursor = await projection.ensureCursor();
        const operations = await projection.listOperationsAfterCursor(
          cursor,
          this.batchSize,
        );
        const postingRowsByOperationId =
          await projection.listProjectionPostingRowsForOperations(operations);
        let processed = 0;

        for (const operation of operations) {
          const postingRows = postingRowsByOperationId.get(operation.id) ?? [];
          const bookIds = [...new Set(postingRows.map((row) => row.bookId))];

          if (
            !(await this.beforeOperation({
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
          this.context.log.info("Projected ledger operations into balances", {
            processed,
            lastOperationId: operations[operations.length - 1]?.id ?? null,
          });
        }

        return processed;
      },
    );
  }

  private createBeforeOperationGuardProxy(
    guard: BeforeOperationGuard | undefined,
  ): BeforeOperationGuard {
    if (!guard) {
      return async () => true;
    }

    return async (input) => guard(input);
  }
}
