import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";

import { TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE } from "./constants";

export async function ingestTreasuryOutcomeReconciliationRecord(input: {
  actorUserId: string;
  dealId: string;
  instruction: Awaited<
    ReturnType<TreasuryModule["instructions"]["queries"]["findById"]>
  >;
  operation: Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["findById"]>
  >;
  reconciliation: Pick<ReconciliationService, "records">;
}) {
  if (!input.instruction || !input.operation) {
    return;
  }

  if (
    input.instruction.state !== "settled" &&
    input.instruction.state !== "returned"
  ) {
    return;
  }

  await input.reconciliation.records.ingestExternalRecord({
    source: TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE,
    sourceRecordId: `${input.instruction.id}:${input.instruction.state}`,
    rawPayload: {
      dealId: input.dealId,
      instructionId: input.instruction.id,
      instructionState: input.instruction.state,
      operationId: input.operation.id,
      operationKind: input.operation.kind,
      providerRef: input.instruction.providerRef,
      providerSnapshot: input.instruction.providerSnapshot,
    },
    normalizedPayload: {
      dealId: input.dealId,
      instructionId: input.instruction.id,
      instructionState: input.instruction.state,
      operationId: input.operation.id,
      operationKind: "treasury",
      treasuryOperationKind: input.operation.kind,
    },
    normalizationVersion: 1,
    actorUserId: input.actorUserId,
    idempotencyKey: `reconciliation:auto:${input.instruction.id}:${input.instruction.state}`,
  });
}
