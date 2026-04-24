import { and, desc, eq, inArray } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryInstructionArtifacts } from "./schema";
import type { TreasuryInstructionArtifactPurpose } from "../../application/contracts/zod";
import type {
  TreasuryInstructionArtifactRecord,
  TreasuryInstructionArtifactWriteModel,
  TreasuryInstructionArtifactsRepository,
} from "../../application/ports/artifacts.repository";

export class DrizzleTreasuryInstructionArtifactsRepository
  implements TreasuryInstructionArtifactsRepository
{
  constructor(private readonly db: Queryable) {}

  async insertArtifact(
    input: TreasuryInstructionArtifactWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [inserted] = await database
      .insert(treasuryInstructionArtifacts)
      .values({
        fileAssetId: input.fileAssetId,
        id: input.id,
        instructionId: input.instructionId,
        memo: input.memo,
        purpose: input.purpose,
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning();

    return inserted as TreasuryInstructionArtifactRecord;
  }

  async listArtifactsByInstructionId(
    instructionId: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord[]> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const rows = await database
      .select()
      .from(treasuryInstructionArtifacts)
      .where(eq(treasuryInstructionArtifacts.instructionId, instructionId))
      .orderBy(desc(treasuryInstructionArtifacts.uploadedAt));

    return rows as TreasuryInstructionArtifactRecord[];
  }

  async listArtifactsByInstructionIds(
    instructionIds: string[],
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord[]> {
    if (instructionIds.length === 0) {
      return [];
    }

    const database = (tx as Transaction | undefined) ?? this.db;
    const rows = await database
      .select()
      .from(treasuryInstructionArtifacts)
      .where(
        inArray(treasuryInstructionArtifacts.instructionId, instructionIds),
      )
      .orderBy(desc(treasuryInstructionArtifacts.uploadedAt));

    return rows as TreasuryInstructionArtifactRecord[];
  }

  async listArtifactsByInstructionIdsAndPurposes(
    input: {
      instructionIds: string[];
      purposes: TreasuryInstructionArtifactPurpose[];
    },
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord[]> {
    if (input.instructionIds.length === 0 || input.purposes.length === 0) {
      return [];
    }

    const database = (tx as Transaction | undefined) ?? this.db;
    const rows = await database
      .select()
      .from(treasuryInstructionArtifacts)
      .where(
        and(
          inArray(
            treasuryInstructionArtifacts.instructionId,
            input.instructionIds,
          ),
          inArray(treasuryInstructionArtifacts.purpose, input.purposes),
        ),
      );

    return rows as TreasuryInstructionArtifactRecord[];
  }
}
