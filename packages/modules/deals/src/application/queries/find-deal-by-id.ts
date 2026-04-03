import { DealNotFoundError } from "../../errors";
import type { DealDetails } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: string): Promise<DealDetails> {
    const deal = await this.reads.findById(id);

    if (!deal) {
      throw new DealNotFoundError(id);
    }

    return deal;
  }
}
