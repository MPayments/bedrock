import { describe, expect, it, vi } from "vitest";

import {
  TreasuryInstructionStateError,
  TreasuryOperationNotFoundError,
} from "../src/errors";
import { createTreasuryInstructionsService } from "../src/instructions/application";
import type {
  TreasuryInstructionRecord,
  TreasuryInstructionsRepository,
  TreasuryInstructionUpdateModel,
  TreasuryInstructionWriteModel,
} from "../src/instructions/application/ports/instructions.repository";

const OPERATION_ID = "00000000-0000-4000-8000-000000000401";
const NOW = new Date("2026-04-03T11:00:00.000Z");

function createOperationRecord() {
  return {
    amountMinor: 10000n,
    counterAmountMinor: null,
    counterCurrencyId: null,
    createdAt: new Date("2026-04-03T10:00:00.000Z"),
    currencyId: "00000000-0000-4000-8000-000000000101",
    customerId: "00000000-0000-4000-8000-000000000201",
    dealId: "00000000-0000-4000-8000-000000000301",
    id: OPERATION_ID,
    internalEntityOrganizationId: "00000000-0000-4000-8000-000000000501",
    kind: "payin" as const,
    quoteId: null,
    sourceRef: "deal:deal-1:leg:1:payin:1",
    state: "planned" as const,
    updatedAt: new Date("2026-04-03T10:00:00.000Z"),
  };
}

function createInstructionsRepository(): TreasuryInstructionsRepository {
  const records = new Map<string, TreasuryInstructionRecord>();

  return {
    async findInstructionById(id) {
      return records.get(id);
    },
    async findInstructionBySourceRef(sourceRef) {
      return Array.from(records.values()).find(
        (record) => record.sourceRef === sourceRef,
      );
    },
    async findLatestInstructionByOperationId(operationId) {
      return Array.from(records.values())
        .filter((record) => record.operationId === operationId)
        .sort((left, right) => right.attempt - left.attempt)[0];
    },
    async insertInstruction(input: TreasuryInstructionWriteModel) {
      const existing = Array.from(records.values()).find(
        (record) => record.sourceRef === input.sourceRef,
      );

      if (existing) {
        return null;
      }

      const record: TreasuryInstructionRecord = {
        attempt: input.attempt,
        createdAt: NOW,
        failedAt: input.failedAt ?? null,
        id: input.id,
        operationId: input.operationId,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
        returnRequestedAt: input.returnRequestedAt ?? null,
        returnedAt: input.returnedAt ?? null,
        settledAt: input.settledAt ?? null,
        sourceRef: input.sourceRef,
        state: input.state,
        submittedAt: input.submittedAt ?? null,
        updatedAt: NOW,
        voidedAt: input.voidedAt ?? null,
      };

      records.set(record.id, record);
      return record;
    },
    async listLatestInstructionsByOperationIds(operationIds) {
      const results = await Promise.all(
        operationIds.map((operationId) =>
          this.findLatestInstructionByOperationId(operationId),
        ),
      );

      return results.filter(
        (
          instruction,
        ): instruction is TreasuryInstructionRecord => instruction !== undefined,
      );
    },
    async updateInstruction(input: TreasuryInstructionUpdateModel) {
      const existing = records.get(input.id);

      if (!existing) {
        return undefined;
      }

      const updated: TreasuryInstructionRecord = {
        ...existing,
        failedAt: input.failedAt ?? existing.failedAt,
        providerRef:
          input.providerRef !== undefined
            ? input.providerRef
            : existing.providerRef,
        providerSnapshot:
          input.providerSnapshot !== undefined
            ? input.providerSnapshot
            : existing.providerSnapshot,
        returnRequestedAt:
          input.returnRequestedAt ?? existing.returnRequestedAt,
        returnedAt: input.returnedAt ?? existing.returnedAt,
        settledAt: input.settledAt ?? existing.settledAt,
        state: input.state,
        submittedAt: input.submittedAt ?? existing.submittedAt,
        updatedAt: NOW,
        voidedAt: input.voidedAt ?? existing.voidedAt,
      };

      records.set(updated.id, updated);
      return updated;
    },
  };
}

function createService(options?: {
  operationExists?: boolean;
  settlementEvidence?: boolean;
}) {
  const instructionsRepository = createInstructionsRepository();
  const operationsRepository = {
    findOperationById: vi.fn(async () =>
      options?.operationExists === false ? undefined : createOperationRecord(),
    ),
  };
  const artifactsRepository = {
    insertArtifact: vi.fn(),
    listArtifactsByInstructionId: vi.fn(async () => []),
    listArtifactsByInstructionIdsAndPurposes: vi.fn(async () =>
      options?.settlementEvidence === false
        ? []
        : [
            {
              fileAssetId: "00000000-0000-4000-8000-000000000999",
              id: "00000000-0000-4000-8000-000000000998",
              instructionId: "00000000-0000-4000-8000-000000000997",
              memo: null,
              purpose: "bank_confirmation",
              uploadedAt: NOW,
              uploadedByUserId: "test-user",
            },
          ],
    ),
  };

  return createTreasuryInstructionsService({
    artifactsRepository: artifactsRepository as any,
    instructionsRepository,
    operationsRepository: operationsRepository as any,
    runtime: {
      generateUuid: vi.fn(),
      log: vi.fn(),
      logger: vi.fn(),
      now: vi.fn(() => NOW),
    } as any,
  });
}

describe("treasury instructions service", () => {
  it("prepares instruction attempt 1 idempotently by sourceRef", async () => {
    const instructions = createService();

    const first = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000901",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:1",
    });
    const replay = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000902",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:1",
    });

    expect(first).toMatchObject({
      attempt: 1,
      id: "00000000-0000-4000-8000-000000000901",
      state: "prepared",
    });
    expect(replay.id).toBe(first.id);
  });

  it("rejects prepare when the treasury operation does not exist", async () => {
    const instructions = createService({ operationExists: false });

    await expect(
      instructions.commands.prepare({
        id: "00000000-0000-4000-8000-000000000901",
        operationId: OPERATION_ID,
        providerRef: null,
        providerSnapshot: null,
        sourceRef: "instruction:prepare:missing",
      }),
    ).rejects.toBeInstanceOf(TreasuryOperationNotFoundError);
  });

  it("submits only from prepared state", async () => {
    const instructions = createService();
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000901",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:submit",
    });

    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });

    expect(submitted).toMatchObject({
      id: prepared.id,
      state: "submitted",
    });

    const failed = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "failed",
      providerRef: null,
      providerSnapshot: null,
    });

    await expect(
      instructions.commands.submit({
        instructionId: failed.id,
        providerRef: null,
        providerSnapshot: null,
      }),
    ).rejects.toBeInstanceOf(TreasuryInstructionStateError);
  });

  it("retries only from latest failed or returned instruction", async () => {
    const instructions = createService();
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000901",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:retry",
    });

    await expect(
      instructions.commands.retry({
        id: "00000000-0000-4000-8000-000000000902",
        operationId: OPERATION_ID,
        providerRef: null,
        providerSnapshot: null,
        sourceRef: "instruction:retry:not-allowed",
      }),
    ).rejects.toBeInstanceOf(TreasuryInstructionStateError);

    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const failed = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "failed",
      providerRef: null,
      providerSnapshot: null,
    });
    const retried = await instructions.commands.retry({
      id: "00000000-0000-4000-8000-000000000903",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:retry:allowed",
    });

    expect(failed.state).toBe("failed");
    expect(retried).toMatchObject({
      attempt: 2,
      state: "prepared",
    });
  });

  it("allows return request only from settled instructions", async () => {
    const instructions = createService();
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000901",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:return",
    });

    await expect(
      instructions.commands.requestReturn({
        instructionId: prepared.id,
        providerRef: null,
        providerSnapshot: null,
      }),
    ).rejects.toBeInstanceOf(TreasuryInstructionStateError);

    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const settled = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "settled",
      providerRef: null,
      providerSnapshot: null,
    });
    const returned = await instructions.commands.requestReturn({
      instructionId: settled.id,
      providerRef: null,
      providerSnapshot: null,
    });

    expect(returned.state).toBe("return_requested");
  });

  it("records outcomes only from valid prior states", async () => {
    const instructions = createService();
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000901",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:outcome",
    });

    await expect(
      instructions.commands.recordOutcome({
        instructionId: prepared.id,
        outcome: "settled",
        providerRef: null,
        providerSnapshot: null,
      }),
    ).rejects.toBeInstanceOf(TreasuryInstructionStateError);

    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const settled = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "settled",
      providerRef: null,
      providerSnapshot: null,
    });
    const returnRequested = await instructions.commands.requestReturn({
      instructionId: settled.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const returned = await instructions.commands.recordOutcome({
      instructionId: returnRequested.id,
      outcome: "returned",
      providerRef: null,
      providerSnapshot: null,
    });

    expect(settled.state).toBe("settled");
    expect(returned.state).toBe("returned");
  });

  it("refuses to settle without any evidence artifact", async () => {
    const instructions = createService({ settlementEvidence: false });
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000910",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:settle-no-evidence",
    });
    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });

    await expect(
      instructions.commands.recordOutcome({
        instructionId: submitted.id,
        outcome: "settled",
        providerRef: null,
        providerSnapshot: null,
      }),
    ).rejects.toThrow(/settlement requires evidence artifact/u);
  });

  it("allows settle when an evidence artifact exists", async () => {
    const instructions = createService({ settlementEvidence: true });
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000911",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:settle-with-evidence",
    });
    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const settled = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "settled",
      providerRef: null,
      providerSnapshot: null,
    });

    expect(settled.state).toBe("settled");
  });

  it("allows outcomes other than settled without requiring evidence", async () => {
    const instructions = createService({ settlementEvidence: false });
    const prepared = await instructions.commands.prepare({
      id: "00000000-0000-4000-8000-000000000912",
      operationId: OPERATION_ID,
      providerRef: null,
      providerSnapshot: null,
      sourceRef: "instruction:prepare:fail-no-evidence",
    });
    const submitted = await instructions.commands.submit({
      instructionId: prepared.id,
      providerRef: null,
      providerSnapshot: null,
    });
    const failed = await instructions.commands.recordOutcome({
      instructionId: submitted.id,
      outcome: "failed",
      providerRef: null,
      providerSnapshot: null,
    });

    expect(failed.state).toBe("failed");
  });
});
