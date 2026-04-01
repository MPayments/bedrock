import {
  ActionReceiptConflictError,
  type IdempotencyService,
} from "@bedrock/platform/idempotency-postgres";
import type { TransactionRunner } from "@bedrock/platform/persistence";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";

export function serializeIdempotencyError(
  error: unknown,
): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
}

export async function withStoredResultRouteIdempotency<TResult extends object>(input: {
  actorId?: string | null;
  idempotency: IdempotencyService;
  idempotencyKey: string;
  persistence: TransactionRunner;
  request: unknown;
  run: () => Promise<TResult>;
  scope: string;
}): Promise<TResult> {
  const requestHash = sha256Hex(canonicalJson(input.request));

  const receiptResult = await input.persistence.runInTransaction((tx) =>
    input.idempotency.createActionReceiptTx({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      scope: input.scope,
      tx,
    }),
  );

  if (receiptResult.kind === "replay") {
    const storedResult = receiptResult.receipt.resultJson as TResult | null;

    if (!storedResult) {
      throw new ActionReceiptConflictError(input.scope, input.idempotencyKey);
    }

    return storedResult;
  }

  try {
    const result = await input.run();

    await input.persistence.runInTransaction((tx) =>
      input.idempotency.completeActionReceiptTx({
        receiptId: receiptResult.receipt.id,
        resultJson: result as unknown as Record<string, unknown>,
        status: "ok",
        tx,
      }),
    );

    return result;
  } catch (error) {
    await input.persistence.runInTransaction((tx) =>
      input.idempotency.completeActionReceiptTx({
        errorJson: serializeIdempotencyError(error),
        receiptId: receiptResult.receipt.id,
        status:
          error instanceof ActionReceiptConflictError ? "conflict" : "error",
        tx,
      }),
    );

    throw error;
  }
}
