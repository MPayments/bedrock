import { randomUUID } from "node:crypto";

import { ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryInstructionOutcome } from "@bedrock/treasury/contracts";

import {
  DEAL_EXECUTION_PREPARE_INSTRUCTION_SCOPE,
  DEAL_EXECUTION_RECORD_OUTCOME_SCOPE,
  DEAL_EXECUTION_REQUEST_RETURN_SCOPE,
  DEAL_EXECUTION_RETRY_INSTRUCTION_SCOPE,
  DEAL_EXECUTION_SUBMIT_INSTRUCTION_SCOPE,
  DEAL_EXECUTION_VOID_INSTRUCTION_SCOPE,
} from "../shared/constants";
import type {
  DealExecutionWorkflowDeps,
  ExecutionLifecycleEventType,
  OperationMutationResult,
} from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import {
  buildInstructionPrepareSourceRef,
  buildInstructionRetrySourceRef,
} from "../shared/instruction-refs";
import { ingestTreasuryOutcomeReconciliationRecord } from "../shared/reconciliation";
import { buildTimelineEvent } from "../shared/timeline";
import {
  requireDealForOperation,
  requireInstructionForMutation,
  requireWorkflow,
} from "../shared/workflow-helpers";

export async function prepareInstruction(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    operationId: string;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const { operation, workflow } = await requireDealForOperation(
        treasuryModule,
        dealsModule,
        input.operationId,
      );
      const latestBefore =
        await treasuryModule.instructions.queries.findLatestByOperationId(
          input.operationId,
        );
      const instruction = await treasuryModule.instructions.commands.prepare({
        id: randomUUID(),
        operationId: input.operationId,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
        sourceRef: buildInstructionPrepareSourceRef(input.operationId),
      });

      if (!latestBefore) {
        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: instruction.attempt,
              instructionId: instruction.id,
              operationId: operation.id,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${instruction.id}:prepared`,
            type: "instruction_prepared",
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const operationId = String(
        storedResult?.operationId ?? input.operationId,
      );
      const operation =
        await treasuryModule.operations.queries.findById(operationId);
      if (!operation?.dealId) {
        throw new ValidationError(
          `Treasury operation ${operationId} is not linked to a deal`,
        );
      }

      await requireWorkflow(dealsModule, operation.dealId);

      return {
        dealId: operation.dealId,
        instructionId:
          typeof storedResult?.instructionId === "string"
            ? storedResult.instructionId
            : null,
        operationId: operation.id,
      };
    },
    request: {
      operationId: input.operationId,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_PREPARE_INSTRUCTION_SCOPE,
    serializeResult: (result) => result,
  });
}

export async function submitInstruction(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    instructionId: string;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const {
        instruction: existing,
        operation,
        workflow,
      } = await requireInstructionForMutation(
        treasuryModule,
        dealsModule,
        input.instructionId,
      );
      const updated = await treasuryModule.instructions.commands.submit({
        instructionId: input.instructionId,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
      });

      if (existing.state !== "submitted") {
        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: updated.attempt,
              instructionId: updated.id,
              operationId: operation.id,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:submitted`,
            type: "instruction_submitted",
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: updated.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const instructionId = String(
        storedResult?.instructionId ?? input.instructionId,
      );
      const { instruction, operation, workflow } =
        await requireInstructionForMutation(
          treasuryModule,
          dealsModule,
          instructionId,
        );

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    request: {
      instructionId: input.instructionId,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_SUBMIT_INSTRUCTION_SCOPE,
    serializeResult: (result) => result,
  });
}

export async function retryInstruction(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    instructionId: string;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const {
        instruction: existing,
        operation,
        workflow,
      } = await requireInstructionForMutation(
        treasuryModule,
        dealsModule,
        input.instructionId,
      );
      const retried = await treasuryModule.instructions.commands.retry({
        id: randomUUID(),
        operationId: operation.id,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
        sourceRef: buildInstructionRetrySourceRef(
          operation.id,
          existing.attempt + 1,
        ),
      });

      if (retried.id !== existing.id) {
        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: retried.attempt,
              instructionId: retried.id,
              operationId: operation.id,
              previousInstructionId: existing.id,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${retried.id}:retried`,
            type: "instruction_retried",
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: retried.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const instructionId = String(
        storedResult?.instructionId ?? input.instructionId,
      );
      const { instruction, operation, workflow } =
        await requireInstructionForMutation(
          treasuryModule,
          dealsModule,
          instructionId,
        );

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    request: {
      instructionId: input.instructionId,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_RETRY_INSTRUCTION_SCOPE,
    serializeResult: (result) => result,
  });
}

export async function voidInstruction(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    instructionId: string;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const {
        instruction: existing,
        operation,
        workflow,
      } = await requireInstructionForMutation(
        treasuryModule,
        dealsModule,
        input.instructionId,
      );
      const updated = await treasuryModule.instructions.commands.void({
        instructionId: input.instructionId,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
      });

      if (existing.state !== "voided") {
        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: updated.attempt,
              instructionId: updated.id,
              operationId: operation.id,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:voided`,
            type: "instruction_voided",
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: updated.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const instructionId = String(
        storedResult?.instructionId ?? input.instructionId,
      );
      const { instruction, operation, workflow } =
        await requireInstructionForMutation(
          treasuryModule,
          dealsModule,
          instructionId,
        );

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    request: {
      instructionId: input.instructionId,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_VOID_INSTRUCTION_SCOPE,
    serializeResult: (result) => result,
  });
}

export async function requestReturn(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    instructionId: string;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const {
        instruction: existing,
        operation,
        workflow,
      } = await requireInstructionForMutation(
        treasuryModule,
        dealsModule,
        input.instructionId,
      );
      const updated =
        await treasuryModule.instructions.commands.requestReturn({
          instructionId: input.instructionId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        });

      if (existing.state !== "return_requested") {
        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: updated.attempt,
              instructionId: updated.id,
              operationId: operation.id,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:return-requested`,
            type: "return_requested",
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: updated.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const instructionId = String(
        storedResult?.instructionId ?? input.instructionId,
      );
      const { instruction, operation, workflow } =
        await requireInstructionForMutation(
          treasuryModule,
          dealsModule,
          instructionId,
        );

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    request: {
      instructionId: input.instructionId,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_REQUEST_RETURN_SCOPE,
    serializeResult: (result) => result,
  });
}

export async function recordInstructionOutcome(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    idempotencyKey: string;
    instructionId: string;
    outcome: TreasuryInstructionOutcome;
    providerRef?: string | null;
    providerSnapshot?: Record<string, unknown> | null;
  },
): Promise<OperationMutationResult> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({
      dealStore,
      dealsModule,
      reconciliation,
      treasuryModule,
    }) => {
      const {
        instruction: existing,
        operation,
        workflow,
      } = await requireInstructionForMutation(
        treasuryModule,
        dealsModule,
        input.instructionId,
      );
      const updated =
        await treasuryModule.instructions.commands.recordOutcome({
          instructionId: input.instructionId,
          outcome: input.outcome,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        });

      await ingestTreasuryOutcomeReconciliationRecord({
        actorUserId: input.actorUserId,
        dealId: workflow.summary.id,
        instruction: updated,
        operation,
        reconciliation,
      });

      if (existing.state !== updated.state) {
        const typeByOutcome: Record<
          TreasuryInstructionOutcome,
          ExecutionLifecycleEventType
        > = {
          failed: "instruction_failed",
          returned: "instruction_returned",
          settled: "instruction_settled",
        };

        await dealStore.createDealTimelineEvents([
          buildTimelineEvent({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            payload: {
              attempt: updated.attempt,
              instructionId: updated.id,
              operationId: operation.id,
              outcome: updated.state,
            },
            sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:outcome:${updated.state}`,
            type: typeByOutcome[input.outcome],
          }),
        ]);
      }

      return {
        dealId: workflow.summary.id,
        instructionId: updated.id,
        operationId: operation.id,
      };
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async (
      { dealsModule, treasuryModule },
      storedResult,
    ) => {
      const instructionId = String(
        storedResult?.instructionId ?? input.instructionId,
      );
      const { instruction, operation, workflow } =
        await requireInstructionForMutation(
          treasuryModule,
          dealsModule,
          instructionId,
        );

      return {
        dealId: workflow.summary.id,
        instructionId: instruction.id,
        operationId: operation.id,
      };
    },
    request: {
      instructionId: input.instructionId,
      outcome: input.outcome,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
    },
    scope: DEAL_EXECUTION_RECORD_OUTCOME_SCOPE,
    serializeResult: (result) => result,
  });
}
