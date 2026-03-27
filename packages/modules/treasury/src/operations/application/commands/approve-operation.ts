import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryOperationDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  ApproveOperationInputSchema,
  type ApproveOperationInput,
} from "../../contracts";
import { applyOperationApproval } from "../../domain/treasury-operation";

export class ApproveOperationCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ApproveOperationInput) {
    const validated = ApproveOperationInputSchema.parse(input);
    const operation = await this.context.reads.findOperation(validated.operationId);
    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", validated.operationId);
    }

    const next = applyOperationApproval(operation, this.context.runtime.now());
    await this.context.unitOfWork.run((tx) =>
      tx.updateOperationStatus({
        id: next.id,
        instructionStatus: next.instructionStatus,
        updatedAt: next.updatedAt,
        approvedAt: next.approvedAt,
        reservedAt: next.reservedAt,
      }),
    );

    return toTreasuryOperationDto(next);
  }
}
