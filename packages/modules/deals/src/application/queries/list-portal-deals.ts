import type { PortalDealListProjection } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class ListPortalDealsQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(input: {
    customerId: string;
    limit: number;
    offset: number;
  }): Promise<PortalDealListProjection> {
    return this.reads.listPortalDeals(input);
  }
}
