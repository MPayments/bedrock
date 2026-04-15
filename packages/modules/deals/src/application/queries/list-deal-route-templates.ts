import type { DealRouteTemplateSummary } from "../contracts/dto";
import type { DealType, DealRouteTemplateStatus } from "../contracts/zod";
import type { DealReads } from "../ports/deal.reads";

export class ListDealRouteTemplatesQuery {
  constructor(private readonly reads: DealReads) {}

  execute(input?: {
    dealType?: DealType;
    status?: DealRouteTemplateStatus[];
  }): Promise<DealRouteTemplateSummary[]> {
    return this.reads.listRouteTemplates(input);
  }
}
