import { DealRouteTemplateNotFoundError } from "../../errors";
import type { DealRouteTemplate } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealRouteTemplateByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: string): Promise<DealRouteTemplate> {
    const template = await this.reads.findRouteTemplateById(id);

    if (!template) {
      throw new DealRouteTemplateNotFoundError(id);
    }

    return template;
  }
}
