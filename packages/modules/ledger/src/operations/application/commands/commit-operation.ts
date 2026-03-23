import type { ModuleRuntime } from "@bedrock/shared/core";

import { BuildPlanRowsCommand } from "./build-plan-rows";
import type { OperationIntentInput } from "../../../contracts";
import { OperationIntentSchema } from "../../../contracts";
import type { InternalLedgerBookGuard } from "../../../shared/application/internal-ledger-book-guard";
import type { SettlementIdentityPolicy } from "../../../shared/application/settlement-identity";
import { validateChainBlocks } from "../../domain/chain-policy";
import {
  buildReplaySettlementMaps,
  computeLinkedFlags,
  computePayloadHash,
} from "../../domain/idempotency";
import {
  OPERATION_TRANSFER_TYPE,
  type CommitResult,
} from "../../domain/operation-intent";
import type { OperationsCommandUnitOfWork } from "../ports/operations.uow";

export class CommitOperationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OperationsCommandUnitOfWork,
    private readonly settlementIdentity: SettlementIdentityPolicy,
    private readonly assertInternalLedgerBooks?: InternalLedgerBookGuard,
  ) {}

  async execute(input: OperationIntentInput): Promise<CommitResult> {
    const result = await this.unitOfWork.run(async (tx) => {
      const validated = OperationIntentSchema.parse(input);
      validateChainBlocks(validated.lines);

      const createLineBookIds = Array.from(
        new Set(
          validated.lines
            .filter((line) => line.type === OPERATION_TRANSFER_TYPE.CREATE)
            .map((line) => line.bookId),
        ),
      );

      if (this.assertInternalLedgerBooks && createLineBookIds.length > 0) {
        await this.assertInternalLedgerBooks({
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
        await tx.operations.acquireOperationId({
          source: validated.source,
          operationCode: validated.operationCode,
          operationVersion: validated.operationVersion,
          idempotencyKey: validated.idempotencyKey,
          payloadHash,
          postingDate: validated.postingDate,
        });

      if (isIdempotentReplay) {
        const incomplete = await tx.operations.isReplayIncomplete({
          operationId,
          lines: validated.lines,
        });

        if (!incomplete) {
          return {
            operationId,
            pendingTransferIdsByRef: buildReplaySettlementMaps({
              operationId,
              lines: validated.lines,
              settlementIdForOperationLine: (line) =>
                this.settlementIdentity.settlementIdForOperationLine(line),
            }).pendingTransferIdsByRef,
          };
        }
      }

      const linkedFlags = computeLinkedFlags(validated.lines);
      const buildPlanRows = new BuildPlanRowsCommand(
        tx.bookAccounts,
        this.settlementIdentity,
      );
      const { postingRows, settlementPlanRows, pendingTransferIdsByRef } =
        await buildPlanRows.execute({
          operationId,
          lines: validated.lines,
          linkedFlags,
        });

      if (postingRows.length > 0) {
        await tx.operations.insertPostings(postingRows);
      }

      await tx.operations.insertSettlementPlans(settlementPlanRows);
      await tx.operations.enqueuePostOperation(operationId);

      return {
        operationId,
        pendingTransferIdsByRef,
      };
    });

    this.runtime.log.info("Ledger operation committed", {
      operationId: result.operationId,
    });

    return result;
  }
}
