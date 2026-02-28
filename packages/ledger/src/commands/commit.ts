import type { Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

import { createDimensionPolicyValidator } from "../internal/commit/dimension-policy";
import {
  acquireOperationId,
  ensureAccountingDefaultsInitialized,
  buildReplayTransferMaps,
  computeLinkedFlags,
  computePayloadHash,
  isReplayIncomplete,
} from "../internal/commit/idempotency";
import { buildPlanRows } from "../internal/commit/tb-plan-building";
import type { LedgerContext } from "../internal/context";
import { type CommitResult, type OperationIntent } from "../types";
import { validateChainBlocks, validateOperationIntent } from "../validation";

export function createCommitHandler(
  _context: LedgerContext,
): (tx: Transaction, intent: OperationIntent) => Promise<CommitResult> {
  return async function commit(
    tx: Transaction,
    intent: OperationIntent,
  ): Promise<CommitResult> {
    const validated = validateOperationIntent(intent);
    const hasCreateLines = validated.lines.some((line) => line.type === "create");
    if (hasCreateLines) {
      await ensureAccountingDefaultsInitialized(tx);
    }
    validateChainBlocks(validated.lines);

    const payloadHash = computePayloadHash({
      operationCode: validated.operationCode,
      operationVersion: validated.operationVersion,
      payload: validated.payload,
      lines: validated.lines,
    });

    const { operationId, isIdempotentReplay } = await acquireOperationId({
      tx,
      source: validated.source,
      operationCode: validated.operationCode,
      operationVersion: validated.operationVersion,
      idempotencyKey: validated.idempotencyKey,
      payloadHash,
      postingDate: validated.postingDate,
    });

    if (isIdempotentReplay) {
      const incomplete = await isReplayIncomplete({
        tx,
        operationId,
        lines: validated.lines,
      });
      if (!incomplete) {
        const replayTransferMaps = buildReplayTransferMaps(
          operationId,
          validated.lines,
        );
        return {
          operationId,
          pendingTransferIdsByRef: replayTransferMaps.pendingTransferIdsByRef,
        };
      }
    }

    const linkedFlags = computeLinkedFlags(validated.lines);
    const validateCreateLine = createDimensionPolicyValidator(tx);
    const { postingRows, tbPlanRows, pendingTransferIdsByRef } =
      await buildPlanRows({
        tx,
        operationId,
        lines: validated.lines,
        linkedFlags,
        validateCreateLine,
      });

    if (postingRows.length > 0) {
      await tx
        .insert(schema.postings)
        .values(postingRows)
        .onConflictDoNothing();
    }

    await tx
      .insert(schema.tbTransferPlans)
      .values(tbPlanRows)
      .onConflictDoNothing();
    await tx
      .insert(schema.outbox)
      .values({ kind: "post_operation", refId: operationId, status: "pending" })
      .onConflictDoNothing();

    return {
      operationId,
      pendingTransferIdsByRef,
    };
  };
}
