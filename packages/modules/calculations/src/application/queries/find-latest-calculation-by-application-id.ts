import type { CalculationReads } from "../ports/calculation.reads";

export class FindLatestCalculationByApplicationIdQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(applicationId: number) {
    return this.reads.findLatestByApplicationId(applicationId);
  }
}
