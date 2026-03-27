import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryOperationDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  ReserveOperationFundsInputSchema,
  type ReserveOperationFundsInput,
} from "../../contracts";
import { applyOperationReservation } from "../../domain/treasury-operation";

function operationRequiresOutboundReservation(operationKind: string) {
  return [
    "payout",
    "intracompany_transfer",
    "intercompany_funding",
    "fx_conversion",
    "sweep",
    "return",
  ].includes(operationKind);
}

export class ReserveOperationFundsCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ReserveOperationFundsInput) {
    const validated = ReserveOperationFundsInputSchema.parse(input);
    const operation = await this.context.reads.findOperation(validated.operationId);
    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", validated.operationId);
    }

    const next = applyOperationReservation(operation, this.context.runtime.now());

    await this.context.unitOfWork.run(async (tx) => {
      await tx.updateOperationStatus({
        id: next.id,
        instructionStatus: next.instructionStatus,
        updatedAt: next.updatedAt,
        approvedAt: next.approvedAt,
        reservedAt: next.reservedAt,
      });

      if (
        operationRequiresOutboundReservation(next.operationKind) &&
        next.sourceAccountId &&
        next.sourceAssetId &&
        next.sourceAmountMinor
      ) {
        await tx.insertAccountBalanceEntries([
          {
            id: this.context.runtime.generateUuid(),
            accountId: next.sourceAccountId,
            assetId: next.sourceAssetId,
            executionEventId: null,
            instructionId: null,
            operationId: next.id,
            balanceState: "reserved",
            legKind: "reserve",
            amountMinor: -next.sourceAmountMinor,
          },
        ]);
      }
    });

    return toTreasuryOperationDto(next);
  }
}
