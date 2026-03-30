import type { CalculationReads } from "../ports/calculation.reads";

export class FindCalculationApplicationIdQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(id: string): Promise<number | null> {
    return this.reads.findApplicationIdByCalculationId(id);
  }
}
