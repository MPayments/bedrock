import { and, eq } from "drizzle-orm";

import { canonicalJson, sha256Hex } from "@multihansa/common";
import type { Transaction } from "@multihansa/common/sql/ports";
import { schema, type ActionReceipt } from "@multihansa/common/operations/schema";

import { ActionReceiptConflictError, ActionReceiptStoredError } from "./errors";
import {
  createIdempotencyServiceContext,
  type IdempotencyServiceDeps,
} from "./internal/context";

type JsonRecord = Record<string, unknown>;

export interface CreateActionReceiptTxInput {
  tx: Transaction;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  actorId?: string | null;
}

type CreateActionReceiptResult =
  | { kind: "new"; receipt: ActionReceipt }
  | { kind: "replay"; receipt: ActionReceipt };

export interface CompleteActionReceiptTxInput {
  tx: Transaction;
  receiptId: string;
  status: ActionReceipt["status"];
  resultJson?: JsonRecord | null;
  errorJson?: JsonRecord | null;
}

export interface WithIdempotencyTxInput<TResult, TStoredResult = JsonRecord> {
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
    receipt: ActionReceipt;
  }) => Promise<TResult>;
  serializeError?: (error: unknown) => JsonRecord;
}

export interface IdempotencyService {
  createActionReceiptTx: (
    input: CreateActionReceiptTxInput,
  ) => Promise<CreateActionReceiptResult>;
  completeActionReceiptTx: (
    input: CompleteActionReceiptTxInput,
  ) => Promise<void>;
  withIdempotencyTx: <TResult, TStoredResult = JsonRecord>(
    input: WithIdempotencyTxInput<TResult, TStoredResult>,
  ) => Promise<TResult>;
}

function defaultSerializeError(error: unknown): JsonRecord {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

async function getStoredReceipt(
  tx: Transaction,
  scope: string,
  idempotencyKey: string,
): Promise<ActionReceipt> {
  const [receipt] = await tx
    .select()
    .from(schema.actionReceipts)
    .where(
      and(
        eq(schema.actionReceipts.scope, scope),
        eq(schema.actionReceipts.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (!receipt) {
    throw new Error(
      `Action receipt disappeared for ${scope}:${idempotencyKey}`,
    );
  }

  return receipt;
}

export function createIdempotencyService(
  deps: IdempotencyServiceDeps = {},
): IdempotencyService {
  const context = createIdempotencyServiceContext(deps);
  const { log } = context;

  async function createActionReceiptTx(
    input: CreateActionReceiptTxInput,
  ): Promise<CreateActionReceiptResult> {
    const { tx, scope, idempotencyKey, requestHash, actorId } = input;

    const [inserted] = await tx
      .insert(schema.actionReceipts)
      .values({
        scope,
        idempotencyKey,
        actorId: actorId ?? null,
        requestHash,
        status: "ok",
        resultJson: null,
        errorJson: null,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return { kind: "new", receipt: inserted };
    }

    const receipt = await getStoredReceipt(tx, scope, idempotencyKey);
    if (receipt.requestHash !== requestHash) {
      log.warn("action receipt hash mismatch", {
        scope,
        idempotencyKey,
      });
      throw new ActionReceiptConflictError(scope, idempotencyKey);
    }

    if (receipt.status === "error") {
      throw new ActionReceiptStoredError(
        scope,
        idempotencyKey,
        receipt.errorJson,
      );
    }

    if (receipt.status === "conflict") {
      throw new ActionReceiptConflictError(scope, idempotencyKey);
    }

    return { kind: "replay", receipt };
  }

  async function completeActionReceiptTx(
    input: CompleteActionReceiptTxInput,
  ): Promise<void> {
    await input.tx
      .update(schema.actionReceipts)
      .set({
        status: input.status,
        resultJson: input.resultJson ?? null,
        errorJson: input.errorJson ?? null,
      })
      .where(eq(schema.actionReceipts.id, input.receiptId));
  }

  async function withIdempotencyTx<TResult, TStoredResult = JsonRecord>(
    input: WithIdempotencyTxInput<TResult, TStoredResult>,
  ): Promise<TResult> {
    const requestHash = sha256Hex(canonicalJson(input.request));
    const receiptResult = await createActionReceiptTx({
      tx: input.tx,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      actorId: input.actorId,
    });

    if (receiptResult.kind === "replay") {
      return input.loadReplayResult({
        tx: input.tx,
        storedResult:
          (receiptResult.receipt.resultJson as TStoredResult | null) ?? null,
        receipt: receiptResult.receipt,
      });
    }

    try {
      const result = await input.handler();

      await completeActionReceiptTx({
        tx: input.tx,
        receiptId: receiptResult.receipt.id,
        status: "ok",
        resultJson: input.serializeResult(result) as JsonRecord,
      });

      return result;
    } catch (error) {
      await completeActionReceiptTx({
        tx: input.tx,
        receiptId: receiptResult.receipt.id,
        status:
          error instanceof ActionReceiptConflictError ? "conflict" : "error",
        errorJson: (input.serializeError ?? defaultSerializeError)(error),
      });

      throw error;
    }
  }

  return {
    createActionReceiptTx,
    completeActionReceiptTx,
    withIdempotencyTx,
  };
}
