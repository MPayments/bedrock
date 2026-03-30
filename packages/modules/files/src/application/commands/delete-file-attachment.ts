import type { FilesCommandUnitOfWork } from "../ports/files.uow";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import type { FileOwnerType } from "../ports/file.reads";
import { FileAssetNotFoundError, FileAttachmentDeletionNotAllowedError } from "../../errors";

export class DeleteFileAttachmentCommand {
  constructor(
    private readonly commandUow: FilesCommandUnitOfWork,
    private readonly objectStorage: ObjectStoragePort | undefined,
    private readonly ownerType: FileOwnerType,
  ) {}

  async execute(input: {
    fileAssetId: string;
    ownerId: string;
  }): Promise<void> {
    const file = await this.commandUow.run(async (tx) => {
      const file = await tx.fileReads.findAttachmentByOwnerAndId({
        fileAssetId: input.fileAssetId,
        ownerId: input.ownerId,
        ownerType: this.ownerType,
      });

      if (!file) {
        throw new FileAssetNotFoundError(input.fileAssetId);
      }

      if (file.origin !== "uploaded") {
        throw new FileAttachmentDeletionNotAllowedError(input.fileAssetId);
      }

      await tx.fileStore.deleteFileAsset(input.fileAssetId);
      return file;
    });

    if (this.objectStorage) {
      await this.objectStorage.queueForDeletion(file.storageKey);
    }
  }
}
