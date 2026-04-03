import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  TreasuryInstructionNotActionableError,
  TreasuryInstructionNotFoundError,
  TreasuryInstructionStateError,
} from "../../../errors";
import {
  VoidTreasuryInstructionInputSchema,
  type VoidTreasuryInstructionInput,
} from "../contracts/commands";
import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class VoidTreasuryInstructionCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly runtime: ModuleRuntime,
  ) {}

  async execute(raw: VoidTreasuryInstructionInput): Promise<TreasuryInstruction> {
    const validated = VoidTreasuryInstructionInputSchema.parse(raw);
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

    if (instruction.state === "voided") {
      return mapTreasuryInstruction(instruction);
    }

    if (instruction.state !== "prepared" && instruction.state !== "submitted") {
      throw new TreasuryInstructionStateError(
        instruction.id,
        instruction.state,
        "void",
      );
    }

    const updated = await this.instructionsRepository.updateInstruction({
      id: instruction.id,
      providerRef: validated.providerRef,
      providerSnapshot: validated.providerSnapshot,
      state: "voided",
      voidedAt: this.runtime.now(),
    });

    if (!updated) {
      throw new TreasuryInstructionNotFoundError(validated.instructionId);
    }

    return mapTreasuryInstruction(updated);
  }
}
