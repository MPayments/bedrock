import type { DealQuoteAcceptanceHistoryItem } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class ListDealQuoteAcceptancesQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(dealId: string): Promise<DealQuoteAcceptanceHistoryItem[]> {
    return this.reads.listQuoteAcceptances(dealId);
  }
}
