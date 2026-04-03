import { ValidationError } from "@bedrock/shared/core/errors";

import { FileAssetNotFoundError } from "../../errors";
import type { FileReads, FileOwnerType } from "../ports/file.reads";
import type { ObjectStoragePort } from "../ports/object-storage.port";

export class GetFileDownloadUrlQuery {
  constructor(
    private readonly reads: FileReads,
    private readonly objectStorage: ObjectStoragePort | undefined,
    private readonly ownerType: FileOwnerType,
  ) {}

  async execute(input: {
    fileAssetId: string;
    ownerId: string;
  }) {
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

    return this.objectStorage.getSignedUrl(file.storageKey);
  }
}
