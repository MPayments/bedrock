import type { Calculation } from "../contracts/dto";
import type { CalculationReads } from "../ports/calculation.reads";

export class ListCalculationsByApplicationIdQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(applicationId: number): Promise<Calculation[]> {
    return this.reads.listByApplicationId(applicationId);
  }
}
