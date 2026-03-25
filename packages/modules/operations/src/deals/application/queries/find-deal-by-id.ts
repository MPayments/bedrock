import { DealNotFoundError } from "../../../errors";
import type { DealReads } from "../ports/deal.reads";

export class FindDealByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: number) {
    const deal = await this.reads.findById(id);
    if (!deal) {
      throw new DealNotFoundError(id);
    }
    return deal;
  }
}
