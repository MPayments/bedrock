import { CalculationNotFoundError } from "../../errors";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationReads } from "../ports/calculation.reads";

export class FindCalculationByIdQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(id: string): Promise<CalculationDetails> {
    const calculation = await this.reads.findById(id);

    if (!calculation) {
      throw new CalculationNotFoundError(id);
    }

    return calculation;
  }
}
