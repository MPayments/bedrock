import { ValidationError } from "@bedrock/shared/core/errors";

import { FileAssetNotFoundError } from "../../errors";
import type { FileAttachmentContent } from "../contracts/dto";
import type { FileReads, FileOwnerType } from "../ports/file.reads";
import type { ObjectStoragePort } from "../ports/object-storage.port";

export class GetFileAttachmentContentQuery {
  constructor(
    private readonly reads: FileReads,
    private readonly objectStorage: ObjectStoragePort | undefined,
    private readonly ownerType: FileOwnerType,
  ) {}

  async execute(input: {
    fileAssetId: string;
    ownerId: string;
  }): Promise<FileAttachmentContent> {
    const file = await this.reads.findAttachmentByOwnerAndId({
      fileAssetId: input.fileAssetId,
      ownerId: input.ownerId,
      ownerType: this.ownerType,
    });

    if (!file) {
      throw new FileAssetNotFoundError(input.fileAssetId);
    }

    if (!this.objectStorage) {
      throw new ValidationError("File storage is not configured");
    }

    return {
      buffer: await this.objectStorage.download(file.storageKey),
      fileName: file.fileName,
      mimeType: file.mimeType,
      purpose: file.attachmentPurpose,
      visibility: file.attachmentVisibility,
    };
  }
}
