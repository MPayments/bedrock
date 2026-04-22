import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import {
  TreasuryInstructionNotActionableError,
  TreasuryInstructionNotFoundError,
  TreasuryInstructionStateError,
} from "../../../errors";
import { TREASURY_INSTRUCTION_SETTLEMENT_EVIDENCE_PURPOSES } from "../../domain/instruction-types";
import {
  RecordTreasuryInstructionOutcomeInputSchema,
  type RecordTreasuryInstructionOutcomeInput,
} from "../contracts/commands";
import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionArtifactsRepository } from "../ports/artifacts.repository";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class RecordTreasuryInstructionOutcomeCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly runtime: ModuleRuntime,
    private readonly artifactsRepository?: TreasuryInstructionArtifactsRepository,
  ) {}

  async execute(
    raw: RecordTreasuryInstructionOutcomeInput,
  ): Promise<TreasuryInstruction> {
    const validated = RecordTreasuryInstructionOutcomeInputSchema.parse(raw);
    const instruction = await this.instructionsRepository.findInstructionById(
      validated.instructionId,
    );

    if (!instruction) {
      throw new TreasuryInstructionNotFoundError(validated.instructionId);
    }

    const latest =
      await this.instructionsRepository.findLatestInstructionByOperationId(
        instruction.operationId,
      );
    if (!latest || latest.id !== instruction.id) {
      throw new TreasuryInstructionNotActionableError(
        instruction.id,
        instruction.state,
      );
    }

    if (instruction.state === validated.outcome) {
      return mapTreasuryInstruction(instruction);
    }

    if (validated.outcome === "settled" || validated.outcome === "failed") {
      if (instruction.state !== "submitted") {
        throw new TreasuryInstructionStateError(
          instruction.id,
          instruction.state,
          `record ${validated.outcome}`,
        );
      }
    } else if (instruction.state !== "return_requested") {
      throw new TreasuryInstructionStateError(
        instruction.id,
        instruction.state,
        "record returned",
      );
    }

    if (validated.outcome === "settled" && this.artifactsRepository) {
      const evidence =
        await this.artifactsRepository.listArtifactsByInstructionIdsAndPurposes(
          {
            instructionIds: [instruction.id],
            purposes: [...TREASURY_INSTRUCTION_SETTLEMENT_EVIDENCE_PURPOSES],
          },
        );

      if (evidence.length === 0) {
        throw new ValidationError(
          "settlement requires evidence artifact",
        );
      }
    }

    const now = this.runtime.now();
    const updated = await this.instructionsRepository.updateInstruction({
      failedAt: validated.outcome === "failed" ? now : undefined,
      id: instruction.id,
      providerRef: validated.providerRef,
      providerSnapshot: validated.providerSnapshot,
      returnedAt: validated.outcome === "returned" ? now : undefined,
      settledAt: validated.outcome === "settled" ? now : undefined,
      state: validated.outcome,
    });

    if (!updated) {
      throw new TreasuryInstructionNotFoundError(validated.instructionId);
    }

    return mapTreasuryInstruction(updated);
  }
}
