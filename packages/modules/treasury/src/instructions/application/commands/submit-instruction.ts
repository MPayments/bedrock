import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  TreasuryInstructionNotActionableError,
  TreasuryInstructionNotFoundError,
  TreasuryInstructionStateError,
} from "../../../errors";
import {
  SubmitTreasuryInstructionInputSchema,
  type SubmitTreasuryInstructionInput,
} from "../contracts/commands";
import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class SubmitTreasuryInstructionCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly runtime: ModuleRuntime,
  ) {}

  async execute(
    raw: SubmitTreasuryInstructionInput,
  ): Promise<TreasuryInstruction> {
    const validated = SubmitTreasuryInstructionInputSchema.parse(raw);
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

    if (instruction.state === "submitted") {
      return mapTreasuryInstruction(instruction);
    }

    if (instruction.state !== "prepared") {
      throw new TreasuryInstructionStateError(
        instruction.id,
        instruction.state,
        "submit",
      );
    }

    const updated = await this.instructionsRepository.updateInstruction({
      id: instruction.id,
      providerRef: validated.providerRef,
      providerSnapshot: validated.providerSnapshot,
      state: "submitted",
      submittedAt: this.runtime.now(),
    });

    if (!updated) {
      throw new TreasuryInstructionNotFoundError(validated.instructionId);
    }

    return mapTreasuryInstruction(updated);
  }
}
