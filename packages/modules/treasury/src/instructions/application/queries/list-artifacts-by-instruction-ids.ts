import { z } from "zod";

import type { TreasuryInstructionArtifact } from "../contracts/dto";
import type { TreasuryInstructionArtifactsRepository } from "../ports/artifacts.repository";

const ListArtifactsByInstructionIdsInputSchema = z.object({
  instructionIds: z.array(z.uuid()),
});

export type ListArtifactsByInstructionIdsInput = z.infer<
  typeof ListArtifactsByInstructionIdsInputSchema
>;

export class ListTreasuryInstructionArtifactsByInstructionIdsQuery {
  constructor(
    private readonly artifactsRepository: TreasuryInstructionArtifactsRepository,
  ) {}

  async execute(
    raw: ListArtifactsByInstructionIdsInput,
  ): Promise<TreasuryInstructionArtifact[]> {
    const validated = ListArtifactsByInstructionIdsInputSchema.parse(raw);

    if (validated.instructionIds.length === 0) {
      return [];
    }

    const rows = await this.artifactsRepository.listArtifactsByInstructionIds(
      validated.instructionIds,
    );

    return rows.map((row) => ({
      fileAssetId: row.fileAssetId,
      id: row.id,
      instructionId: row.instructionId,
      memo: row.memo,
      purpose: row.purpose,
      uploadedAt: row.uploadedAt,
      uploadedByUserId: row.uploadedByUserId,
    }));
  }
}
