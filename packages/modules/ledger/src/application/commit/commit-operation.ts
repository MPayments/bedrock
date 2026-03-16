import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { buildPlanRows } from "./build-plan-rows";
import type { LedgerOperationsWritePort } from "./ports";
import {
  OperationIntentSchema,
  type OperationIntentInput,
} from "../../contracts";
import { validateChainBlocks } from "../../domain/chain-policy";
import {
  buildReplayTransferMaps,
  computeLinkedFlags,
  computePayloadHash,
} from "../../domain/idempotency";
import {
  OPERATION_TRANSFER_TYPE,
  type CommitResult,
} from "../../domain/operation-intent";
import type { LedgerBookAccountsPort } from "../book-accounts/ports";
import type { InternalLedgerBookGuard } from "../shared/context";

export function createCommitOperationHandler(input: {
  operations: LedgerOperationsWritePort;
  bookAccounts: LedgerBookAccountsPort;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}) {
  const { operations, bookAccounts, assertInternalLedgerBooks } = input;

  return async function commit(
    tx: PersistenceSession,
    intent: OperationIntentInput,
  ): Promise<CommitResult> {
    const validated = OperationIntentSchema.parse(intent);
    validateChainBlocks(validated.lines);

    const createLineBookIds = Array.from(
      new Set(
        validated.lines
          .filter((line) => line.type === OPERATION_TRANSFER_TYPE.CREATE)
          .map((line) => line.bookId),
      ),
    );

    if (assertInternalLedgerBooks && createLineBookIds.length > 0) {
      await assertInternalLedgerBooks({
        bookIds: createLineBookIds,
      });
    }

    const payloadHash = computePayloadHash({
      operationCode: validated.operationCode,
      operationVersion: validated.operationVersion,
      payload: validated.payload,
      lines: validated.lines,
    });

    const { operationId, isIdempotentReplay } =
      await operations.acquireOperationId(tx, {
        source: validated.source,
        operationCode: validated.operationCode,
        operationVersion: validated.operationVersion,
        idempotencyKey: validated.idempotencyKey,
        payloadHash,
        postingDate: validated.postingDate,
      });

    if (isIdempotentReplay) {
      const incomplete = await operations.isReplayIncomplete(tx, {
        operationId,
        lines: validated.lines,
      });

      if (!incomplete) {
        return {
          operationId,
          pendingTransferIdsByRef: buildReplayTransferMaps(
            operationId,
            validated.lines,
          ).pendingTransferIdsByRef,
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
        bookAccounts,
      });

    if (postingRows.length > 0) {
      await operations.insertPostings(tx, postingRows);
    }

    await operations.insertTransferPlans(tx, tbPlanRows);
    await operations.enqueuePostOperation(tx, operationId);

    return {
      operationId,
      pendingTransferIdsByRef,
    };
  };
}
