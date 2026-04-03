import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealWorkflowsByIdsQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(ids: string[]): Promise<DealWorkflowProjection[]> {
    return this.reads.findWorkflowsByIds(ids);
  }
}
