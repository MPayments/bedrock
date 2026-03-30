import type { FileReads, FileOwnerType } from "../ports/file.reads";

export class ListFileAttachmentsQuery {
  constructor(
    private readonly reads: FileReads,
    private readonly ownerType: FileOwnerType,
  ) {}

  execute(ownerId: string) {
    return this.reads.listAttachmentsByOwner({
      ownerId,
      ownerType: this.ownerType,
    });
  }
}
