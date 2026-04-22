import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { TreasuryInstructionArtifactPurpose } from "../contracts/zod";

export interface TreasuryInstructionArtifactRecord {
  fileAssetId: string;
  id: string;
  instructionId: string;
  memo: string | null;
  purpose: TreasuryInstructionArtifactPurpose;
  uploadedAt: Date;
  uploadedByUserId: string;
}

export interface TreasuryInstructionArtifactWriteModel {
  fileAssetId: string;
  id: string;
  instructionId: string;
  memo: string | null;
  purpose: TreasuryInstructionArtifactPurpose;
  uploadedByUserId: string;
}

export interface TreasuryInstructionArtifactsRepository {
  insertArtifact(
    input: TreasuryInstructionArtifactWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord>;
  listArtifactsByInstructionId(
    instructionId: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord[]>;
  listArtifactsByInstructionIdsAndPurposes(
    input: {
      instructionIds: string[];
      purposes: TreasuryInstructionArtifactPurpose[];
    },
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionArtifactRecord[]>;
}
