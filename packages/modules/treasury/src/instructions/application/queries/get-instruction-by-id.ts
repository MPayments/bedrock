import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class GetTreasuryInstructionByIdQuery {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
  ) {}

  async execute(id: string): Promise<TreasuryInstruction | null> {
    const instruction = await this.instructionsRepository.findInstructionById(id);

    return instruction ? mapTreasuryInstruction(instruction) : null;
  }
}
