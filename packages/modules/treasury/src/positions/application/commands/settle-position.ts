import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryPositionDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  SettlePositionInputSchema,
  type SettlePositionInput,
} from "../../contracts";
import { applyPositionSettlement } from "../../domain/treasury-position";

export class SettlePositionCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: SettlePositionInput) {
    const validated = SettlePositionInputSchema.parse(input);
    const position = await this.context.reads.findPosition(validated.positionId);
    if (!position) {
      throw new TreasuryEntityNotFoundError(
        "TreasuryPosition",
        validated.positionId,
      );
    }

    const nextPosition = applyPositionSettlement({
      position,
      amountMinor: BigInt(validated.amountMinor),
      now: this.context.runtime.now(),
    });

    await this.context.unitOfWork.run((tx) =>
      tx.updatePosition({
        id: nextPosition.id,
        amountMinor: nextPosition.amountMinor,
        settledMinor: nextPosition.settledMinor,
        updatedAt: nextPosition.updatedAt,
        closedAt: nextPosition.closedAt,
      }),
    );

    return toTreasuryPositionDto(nextPosition);
  }
}
