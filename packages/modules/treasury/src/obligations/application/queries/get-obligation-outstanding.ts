import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toObligationOutstandingDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";

export class GetObligationOutstandingQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: { obligationId: string }) {
    const obligation = await this.context.reads.findObligation(
      input.obligationId,
    );
    if (!obligation) {
      throw new TreasuryEntityNotFoundError("Obligation", input.obligationId);
    }

    return toObligationOutstandingDto(obligation);
  }
}
