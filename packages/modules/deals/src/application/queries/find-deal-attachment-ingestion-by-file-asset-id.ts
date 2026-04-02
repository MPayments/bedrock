import type { DealAttachmentIngestion } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealAttachmentIngestionByFileAssetIdQuery {
  constructor(private readonly reads: DealReads) {}

  execute(fileAssetId: string): Promise<DealAttachmentIngestion | null> {
    return this.reads.findAttachmentIngestionByFileAssetId(fileAssetId);
  }
}
