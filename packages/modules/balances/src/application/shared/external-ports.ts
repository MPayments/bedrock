import type { BalancesStateRepository } from "../balances/ports";
import type { BalancesProjectionRepository } from "../projection/ports";

type JsonRecord = Record<string, unknown>;

export interface BalancesIdempotencyPort {
  withIdempotency<TResult, TStoredResult = JsonRecord>(input: {
    scope: string;
    idempotencyKey: string;
    request: unknown;
    actorId?: string | null;
    handler: () => Promise<TResult>;
    serializeResult: (result: TResult) => TStoredResult;
    loadReplayResult: (params: {
      storedResult: TStoredResult | null;
    }) => Promise<TResult>;
    serializeError?: (error: unknown) => JsonRecord;
  }): Promise<TResult>;
}

export interface BalancesTransactionContext {
  stateRepository: BalancesStateRepository;
  idempotency: BalancesIdempotencyPort;
}

export interface BalancesTransactionsPort {
  withTransaction<TResult>(
    run: (context: BalancesTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface BalancesProjectionTransactionContext {
  projectionRepository: BalancesProjectionRepository;
}

export interface BalancesProjectionTransactionsPort {
  withTransaction<TResult>(
    run: (context: BalancesProjectionTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
