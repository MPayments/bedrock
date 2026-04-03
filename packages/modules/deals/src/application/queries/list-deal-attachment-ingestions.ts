import type { DealAttachmentIngestion } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class ListDealAttachmentIngestionsQuery {
  constructor(private readonly reads: DealReads) {}

  execute(dealId: string): Promise<DealAttachmentIngestion[]> {
    return this.reads.listAttachmentIngestionsByDealId(dealId);
  }
}
