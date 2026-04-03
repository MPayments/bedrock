import { desc, eq, inArray } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryInstructions } from "./schema";
import type {
  TreasuryInstructionRecord,
  TreasuryInstructionsRepository,
  TreasuryInstructionUpdateModel,
  TreasuryInstructionWriteModel,
} from "../../application/ports/instructions.repository";

export class DrizzleTreasuryInstructionsRepository
  implements TreasuryInstructionsRepository
{
  constructor(private readonly db: Queryable) {}

  async findInstructionById(id: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [instruction] = await database
      .select()
      .from(treasuryInstructions)
      .where(eq(treasuryInstructions.id, id))
      .limit(1);

    return instruction as TreasuryInstructionRecord | undefined;
  }

  async findInstructionBySourceRef(sourceRef: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [instruction] = await database
      .select()
      .from(treasuryInstructions)
      .where(eq(treasuryInstructions.sourceRef, sourceRef))
      .limit(1);

    return instruction as TreasuryInstructionRecord | undefined;
  }

  async findLatestInstructionByOperationId(
    operationId: string,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [instruction] = await database
      .select()
      .from(treasuryInstructions)
      .where(eq(treasuryInstructions.operationId, operationId))
      .orderBy(
        desc(treasuryInstructions.attempt),
        desc(treasuryInstructions.createdAt),
      )
      .limit(1);

    return instruction as TreasuryInstructionRecord | undefined;
  }

  async insertInstruction(
    input: TreasuryInstructionWriteModel,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryInstructions)
      .values(input)
      .onConflictDoNothing({
        target: treasuryInstructions.sourceRef,
      })
      .returning();

    return (inserted[0] as TreasuryInstructionRecord | undefined) ?? null;
  }

  async listLatestInstructionsByOperationIds(
    operationIds: string[],
    tx?: PersistenceSession,
  ) {
    if (operationIds.length === 0) {
      return [];
    }

    const database = (tx as Transaction | undefined) ?? this.db;
    const rows = await database
      .select()
      .from(treasuryInstructions)
      .where(inArray(treasuryInstructions.operationId, operationIds))
      .orderBy(
        treasuryInstructions.operationId,
        desc(treasuryInstructions.attempt),
        desc(treasuryInstructions.createdAt),
      );

    const latestByOperationId = new Map<string, TreasuryInstructionRecord>();

    for (const row of rows as TreasuryInstructionRecord[]) {
      if (!latestByOperationId.has(row.operationId)) {
        latestByOperationId.set(row.operationId, row);
      }
    }

    return operationIds
      .map((operationId) => latestByOperationId.get(operationId))
      .filter((row): row is TreasuryInstructionRecord => Boolean(row));
  }

  async updateInstruction(
    input: TreasuryInstructionUpdateModel,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const values: Record<string, unknown> = {
      state: input.state,
    };

    if ("failedAt" in input) {
      values.failedAt = input.failedAt ?? null;
    }
    if ("providerRef" in input) {
      values.providerRef = input.providerRef ?? null;
    }
    if ("providerSnapshot" in input) {
      values.providerSnapshot = input.providerSnapshot ?? null;
    }
    if ("returnRequestedAt" in input) {
      values.returnRequestedAt = input.returnRequestedAt ?? null;
    }
    if ("returnedAt" in input) {
      values.returnedAt = input.returnedAt ?? null;
    }
    if ("settledAt" in input) {
      values.settledAt = input.settledAt ?? null;
    }
    if ("submittedAt" in input) {
      values.submittedAt = input.submittedAt ?? null;
    }
    if ("voidedAt" in input) {
      values.voidedAt = input.voidedAt ?? null;
    }

    const updated = await database
      .update(treasuryInstructions)
      .set(values)
      .where(eq(treasuryInstructions.id, input.id))
      .returning();

    return updated[0] as TreasuryInstructionRecord | undefined;
  }
}
