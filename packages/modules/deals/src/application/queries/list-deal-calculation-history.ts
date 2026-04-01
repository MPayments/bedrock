import type { DealCalculationHistoryItem } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class ListDealCalculationHistoryQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(dealId: string): Promise<DealCalculationHistoryItem[]> {
    return this.reads.listCalculationHistory(dealId);
  }
}
