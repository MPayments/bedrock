export interface DocumentsIdempotencyPort {
  withIdempotency<TResult, TStoredResult = Record<string, unknown>>(input: {
    scope: string;
    idempotencyKey: string;
    request: unknown;
    actorId?: string | null;
    handler: () => Promise<TResult>;
    serializeResult: (result: TResult) => TStoredResult;
    loadReplayResult: (params: {
      storedResult: TStoredResult | null;
    }) => Promise<TResult>;
    serializeError?: (error: unknown) => Record<string, unknown>;
  }): Promise<TResult>;
}
