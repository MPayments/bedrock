import type { Transaction } from "@bedrock/platform-persistence";

type JsonRecord = Record<string, unknown>;

export interface StoredActionReceipt {
  id: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  status: string;
  resultJson: unknown;
  errorJson: unknown;
}

export interface WithIdempotencyTxInput<
  TResult,
  TStoredResult = JsonRecord,
> {
  tx: Transaction;
  scope: string;
  idempotencyKey: string;
  request: unknown;
  actorId?: string | null;
  handler: () => Promise<TResult>;
  serializeResult: (result: TResult) => TStoredResult;
  loadReplayResult: (params: {
    tx: Transaction;
    storedResult: TStoredResult | null;
    receipt: StoredActionReceipt;
  }) => Promise<TResult>;
  serializeError?: (error: unknown) => JsonRecord;
}

export interface IdempotencyPort {
  withIdempotencyTx<TResult, TStoredResult = JsonRecord>(
    input: WithIdempotencyTxInput<TResult, TStoredResult>,
  ): Promise<TResult>;
}
