import { z } from "zod";

import type { TreasuryInstructionArtifact } from "../contracts/dto";
import type { TreasuryInstructionArtifactsRepository } from "../ports/artifacts.repository";

const ListInstructionArtifactsInputSchema = z.object({
  instructionId: z.uuid(),
});

export type ListInstructionArtifactsInput = z.infer<
  typeof ListInstructionArtifactsInputSchema
>;

export class ListTreasuryInstructionArtifactsQuery {
  constructor(
    private readonly artifactsRepository: TreasuryInstructionArtifactsRepository,
  ) {}

  async execute(
    raw: ListInstructionArtifactsInput,
  ): Promise<TreasuryInstructionArtifact[]> {
    const validated = ListInstructionArtifactsInputSchema.parse(raw);
    const rows = await this.artifactsRepository.listArtifactsByInstructionId(
      validated.instructionId,
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
