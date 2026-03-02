import type { Transaction } from "@bedrock/foundation/db/types";
import { schema } from "@bedrock/ledger/schema";

import {
  acquireOperationId,
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
    const { postingRows, tbPlanRows, pendingTransferIdsByRef } =
      await buildPlanRows({
        tx,
        operationId,
        lines: validated.lines,
        linkedFlags,
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
