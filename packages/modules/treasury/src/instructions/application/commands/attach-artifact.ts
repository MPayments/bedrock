import type { ModuleRuntime } from "@bedrock/shared/core";

import { TreasuryInstructionNotFoundError } from "../../../errors";
import {
  AttachTreasuryInstructionArtifactInputSchema,
  type AttachTreasuryInstructionArtifactInput,
} from "../contracts/commands";
import type { TreasuryInstructionArtifact } from "../contracts/dto";
import type { TreasuryInstructionArtifactsRepository } from "../ports/artifacts.repository";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class AttachTreasuryInstructionArtifactCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly artifactsRepository: TreasuryInstructionArtifactsRepository,
    private readonly runtime: ModuleRuntime,
  ) {}

  async execute(
    raw: AttachTreasuryInstructionArtifactInput,
  ): Promise<TreasuryInstructionArtifact> {
    const validated =
      AttachTreasuryInstructionArtifactInputSchema.parse(raw);

    const instruction = await this.instructionsRepository.findInstructionById(
      validated.instructionId,
    );
    if (!instruction) {
      throw new TreasuryInstructionNotFoundError(validated.instructionId);
    }

    const inserted = await this.artifactsRepository.insertArtifact({
      fileAssetId: validated.fileAssetId,
      id: this.runtime.generateUuid(),
      instructionId: validated.instructionId,
      memo: validated.memo ?? null,
      purpose: validated.purpose,
      uploadedByUserId: validated.actorUserId,
    });

    return {
      fileAssetId: inserted.fileAssetId,
      id: inserted.id,
      instructionId: inserted.instructionId,
      memo: inserted.memo,
      purpose: inserted.purpose,
      uploadedAt: inserted.uploadedAt,
      uploadedByUserId: inserted.uploadedByUserId,
    };
  }
}
