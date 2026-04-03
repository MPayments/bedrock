import {
  TreasuryInstructionNotActionableError,
  TreasuryInstructionNotFoundError,
  TreasuryOperationNotFoundError,
} from "../../../errors";
import type { TreasuryOperationsRepository } from "../../../operations/application/ports/operations.repository";
import {
  PrepareTreasuryInstructionInputSchema,
  type PrepareTreasuryInstructionInput,
} from "../contracts/commands";
import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class PrepareTreasuryInstructionCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
  ) {}

  async execute(
    raw: PrepareTreasuryInstructionInput,
  ): Promise<TreasuryInstruction> {
    const validated = PrepareTreasuryInstructionInputSchema.parse(raw);
    const operation = await this.operationsRepository.findOperationById(
      validated.operationId,
    );

    if (!operation) {
      throw new TreasuryOperationNotFoundError(validated.operationId);
    }

    const inserted = await this.instructionsRepository.insertInstruction({
      attempt: 1,
      id: validated.id,
      operationId: validated.operationId,
      providerRef: validated.providerRef,
      providerSnapshot: validated.providerSnapshot,
      sourceRef: validated.sourceRef,
      state: "prepared",
    });

    if (inserted) {
      return mapTreasuryInstruction(inserted);
    }

    const existing = await this.instructionsRepository.findInstructionBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new TreasuryInstructionNotFoundError(validated.sourceRef);
    }

    const latest =
      await this.instructionsRepository.findLatestInstructionByOperationId(
        validated.operationId,
      );

    if (latest && latest.id !== existing.id) {
      throw new TreasuryInstructionNotActionableError(existing.id, existing.state);
    }

    return mapTreasuryInstruction(existing);
  }
}
