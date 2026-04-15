import { DealNotFoundError } from "../../errors";
import type { DealRouteVersion } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindCurrentDealRouteByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(dealId: string): Promise<DealRouteVersion | null> {
    const route = await this.reads.findCurrentRouteByDealId(dealId);

    if (route) {
      return route;
    }

    const deal = await this.reads.findById(dealId);
    if (!deal) {
      throw new DealNotFoundError(dealId);
    }

    return null;
  }
}
