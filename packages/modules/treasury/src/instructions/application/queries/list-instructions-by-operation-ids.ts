import { z } from "zod";

import type { TreasuryInstruction } from "../contracts/dto";
import type { TreasuryInstructionsRepository } from "../ports/instructions.repository";

const ListInstructionsByOperationIdsInputSchema = z.object({
  operationIds: z.array(z.uuid()),
});

export type ListInstructionsByOperationIdsInput = z.infer<
  typeof ListInstructionsByOperationIdsInputSchema
>;

export class ListTreasuryInstructionsByOperationIdsQuery {
  constructor(
    private readonly instructionsRepository: TreasuryInstructionsRepository,
  ) {}

  async execute(
    raw: ListInstructionsByOperationIdsInput,
  ): Promise<TreasuryInstruction[]> {
    const validated = ListInstructionsByOperationIdsInputSchema.parse(raw);
    if (validated.operationIds.length === 0) return [];
    const rows =
      await this.instructionsRepository.listInstructionsByOperationIds(
        validated.operationIds,
      );
    return rows.map((row) => ({
      attempt: row.attempt,
      createdAt: row.createdAt,
      failedAt: row.failedAt ?? null,
      id: row.id,
      operationId: row.operationId,
      providerRef: row.providerRef ?? null,
      providerSnapshot: row.providerSnapshot ?? null,
      returnRequestedAt: row.returnRequestedAt ?? null,
      returnedAt: row.returnedAt ?? null,
      settledAt: row.settledAt ?? null,
      sourceRef: row.sourceRef,
      state: row.state,
      submittedAt: row.submittedAt ?? null,
      updatedAt: row.updatedAt,
      voidedAt: row.voidedAt ?? null,
    }));
  }
}
