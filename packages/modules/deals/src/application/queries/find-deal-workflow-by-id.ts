import { DealNotFoundError } from "../../errors";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealWorkflowByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: string): Promise<DealWorkflowProjection> {
    const workflow = await this.reads.findWorkflowById(id);

    if (!workflow) {
      throw new DealNotFoundError(id);
    }

    return workflow;
  }
}
