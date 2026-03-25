import { CalculationNotFoundError } from "../../../errors";
import type { CalculationReads } from "../ports/calculation.reads";

export class FindCalculationByIdQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(id: number) {
    const calculation = await this.reads.findById(id);
    if (!calculation) {
      throw new CalculationNotFoundError(id);
    }
    return calculation;
  }
}
