import type {
  DealExecutionTxDeps,
  DealExecutionWorkflowDeps,
} from "./deps";

export async function runIdempotent<
  TResult,
  TStoredResult extends Record<string, unknown>,
>(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    handler: (txDeps: DealExecutionTxDeps) => Promise<TResult>;
    idempotencyKey: string;
    loadReplayResult: (
      txDeps: DealExecutionTxDeps,
      storedResult: TStoredResult | null,
    ) => Promise<TResult>;
    request: Record<string, unknown>;
    scope: string;
    serializeResult: (result: TResult) => TStoredResult;
  },
): Promise<TResult> {
  return deps.db.transaction(async (tx) => {
    const txDeps: DealExecutionTxDeps = {
      dealStore: deps.createDealStore(tx),
      dealsModule: deps.createDealsModule(tx),
      reconciliation: deps.createReconciliationService(tx),
      treasuryModule: deps.createTreasuryModule(tx),
    };

    return deps.idempotency.withIdempotencyTx({
      tx,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      actorId: input.actorUserId,
      serializeResult: (result) => input.serializeResult(result as TResult),
      loadReplayResult: async ({ storedResult }) =>
        input.loadReplayResult(
          txDeps,
          (storedResult as TStoredResult | null | undefined) ?? null,
        ),
      handler: async () => input.handler(txDeps),
    });
  });
}
