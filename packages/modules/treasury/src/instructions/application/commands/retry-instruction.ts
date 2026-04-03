import {
  TreasuryInstructionNotActionableError,
  TreasuryInstructionNotFoundError,
  TreasuryInstructionStateError,
  TreasuryOperationNotFoundError,
} from "../../../errors";
import type { TreasuryOperationsRepository } from "../../../operations/application/ports/operations.repository";
import {
  RetryTreasuryInstructionInputSchema,
  type RetryTreasuryInstructionInput,
} from "../contracts/commands";
import type { TreasuryInstruction } from "../contracts/dto";
import { mapTreasuryInstruction } from "../map-instruction";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

export class RetryTreasuryInstructionCommand {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
  ) {}

  async execute(raw: RetryTreasuryInstructionInput): Promise<TreasuryInstruction> {
    const validated = RetryTreasuryInstructionInputSchema.parse(raw);
    const operation = await this.operationsRepository.findOperationById(
      validated.operationId,
    );

    if (!operation) {
      throw new TreasuryOperationNotFoundError(validated.operationId);
    }

    const latest =
      await this.instructionsRepository.findLatestInstructionByOperationId(
        validated.operationId,
      );

    if (!latest) {
      throw new TreasuryInstructionNotFoundError(validated.operationId);
    }

    if (latest.state !== "failed" && latest.state !== "returned") {
      throw new TreasuryInstructionStateError(
        latest.id,
        latest.state,
        "retry",
      );
    }

    const inserted = await this.instructionsRepository.insertInstruction({
      attempt: latest.attempt + 1,
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

    const refreshedLatest =
      await this.instructionsRepository.findLatestInstructionByOperationId(
        validated.operationId,
      );
    if (refreshedLatest && refreshedLatest.id !== existing.id) {
      throw new TreasuryInstructionNotActionableError(existing.id, existing.state);
    }

    return mapTreasuryInstruction(existing);
  }
}
