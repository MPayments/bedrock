import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstruction } from "../contracts/dto";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class GetLatestTreasuryInstructionByOperationIdQuery {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
  ) {}

  async execute(operationId: string): Promise<TreasuryInstruction | null> {
    const instruction =
      await this.instructionsRepository.findLatestInstructionByOperationId(
        operationId,
      );

    return instruction ? mapTreasuryInstruction(instruction) : null;
  }
}
