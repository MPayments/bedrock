import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class ListLatestTreasuryInstructionsByOperationIdsQuery {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
  ) {}

  async execute(operationIds: string[]): Promise<TreasuryInstruction[]> {
    const instructions =
      await this.instructionsRepository.listLatestInstructionsByOperationIds(
        operationIds,
      );

    return instructions.map(mapTreasuryInstruction);
  }
}
