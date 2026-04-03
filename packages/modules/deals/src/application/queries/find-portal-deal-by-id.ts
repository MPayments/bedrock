import { DealNotFoundError } from "../../errors";
import type { PortalDealProjection } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindPortalDealByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: string): Promise<PortalDealProjection> {
    const projection = await this.reads.findPortalProjectionById(id);

    if (!projection) {
      throw new DealNotFoundError(id);
    }

    return projection;
  }
}
