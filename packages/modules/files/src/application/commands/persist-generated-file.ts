import type { ModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ValidationError } from "@bedrock/shared/core/errors";

import { GENERATED_FILE_LINK_KINDS } from "../../domain/constants";
import type {
  FileGeneratedFormat,
  FileGeneratedLang,
  FileLinkKind,
} from "../contracts/zod";
import type { FileOwnerType } from "../ports/file.reads";
import type { FilesCommandUnitOfWork } from "../ports/files.uow";
import type { ObjectStoragePort } from "../ports/object-storage.port";

function sanitizeGeneratedName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .replace(/\._/g, ".");
}

function buildGeneratedStorageKey(input: {
  assetId: string;
  fileName: string;
  generatedFormat: FileGeneratedFormat;
  generatedLang: FileGeneratedLang;
  linkKind: FileLinkKind;
  ownerId: string;
  versionNumber: number;
}) {
  return [
    "files",
    "generated",
    input.linkKind,
    input.ownerId,
    input.generatedLang,
    input.generatedFormat,
    input.assetId,
    `v${input.versionNumber}`,
    sanitizeGeneratedName(input.fileName),
  ].join("/");
}

export class PersistGeneratedFileCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: FilesCommandUnitOfWork,
    private readonly objectStorage: ObjectStoragePort | undefined,
    private readonly ownerType: FileOwnerType,
  ) {}

  async execute(input: {
    buffer: Buffer;
    createdBy: string | null;
    fileName: string;
    fileSize: number;
    generatedFormat: FileGeneratedFormat;
    generatedLang: FileGeneratedLang;
    linkKind: FileLinkKind;
    mimeType: string;
    ownerId: string;
  }): Promise<{ createdNewVersion: boolean; fileAssetId: string }> {
    if (!this.objectStorage) {
      throw new ValidationError("File storage is not configured");
    }
    if (!GENERATED_FILE_LINK_KINDS.has(input.linkKind)) {
      throw new ValidationError(
        `linkKind ${input.linkKind} is not a generated file kind`,
      );
    }
    const objectStorage = this.objectStorage;

    return this.commandUow.run(async (tx) => {
      const checksum = sha256Hex(input.buffer.toString("base64"));
      const existing = await tx.fileReads.findGeneratedByOwner({
        ownerType: this.ownerType,
        ownerId: input.ownerId,
        linkKind: input.linkKind,
        generatedFormat: input.generatedFormat,
        generatedLang: input.generatedLang,
      });

      if (!existing) {
        const fileAssetId = this.runtime.generateUuid();
        const versionId = this.runtime.generateUuid();
        const linkId = this.runtime.generateUuid();
        const storageKey = buildGeneratedStorageKey({
          assetId: fileAssetId,
          fileName: input.fileName,
          generatedFormat: input.generatedFormat,
          generatedLang: input.generatedLang,
          linkKind: input.linkKind,
          ownerId: input.ownerId,
          versionNumber: 1,
        });

        await objectStorage.upload(storageKey, input.buffer, input.mimeType);

        try {
          await tx.fileStore.createFileAssetRoot({
            id: fileAssetId,
            origin: "generated",
            description: null,
            createdBy: input.createdBy,
          });
          await tx.fileStore.createFileVersion({
            id: versionId,
            fileAssetId,
            versionNumber: 1,
            fileName: input.fileName,
            fileSize: input.fileSize,
            mimeType: input.mimeType,
            storageKey,
            checksum,
            createdBy: input.createdBy,
          });
          await tx.fileStore.createFileLink({
            attachmentPurpose: null,
            attachmentVisibility: null,
            id: linkId,
            fileAssetId,
            linkKind: input.linkKind,
            dealId: this.ownerType === "deal" ? input.ownerId : null,
            counterpartyId:
              this.ownerType === "counterparty" ? input.ownerId : null,
            paymentStepId:
              this.ownerType === "payment_step" ? input.ownerId : null,
            generatedFormat: input.generatedFormat,
            generatedLang: input.generatedLang,
          });
          await tx.fileStore.setCurrentVersion({
            fileAssetId,
            currentVersionId: versionId,
          });
        } catch (error) {
          await objectStorage.queueForDeletion(storageKey);
          throw error;
        }

        return { createdNewVersion: true, fileAssetId };
      }

      if (existing.checksum === checksum) {
        return { createdNewVersion: false, fileAssetId: existing.id };
      }

      const versionNumber = existing.currentVersionNumber + 1;
      const versionId = this.runtime.generateUuid();
      const storageKey = buildGeneratedStorageKey({
        assetId: existing.id,
        fileName: input.fileName,
        generatedFormat: input.generatedFormat,
        generatedLang: input.generatedLang,
        linkKind: input.linkKind,
        ownerId: input.ownerId,
        versionNumber,
      });

      await objectStorage.upload(storageKey, input.buffer, input.mimeType);

      try {
        await tx.fileStore.createFileVersion({
          id: versionId,
          fileAssetId: existing.id,
          versionNumber,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          storageKey,
          checksum,
          createdBy: input.createdBy,
        });
        await tx.fileStore.setCurrentVersion({
          fileAssetId: existing.id,
          currentVersionId: versionId,
        });
      } catch (error) {
        await objectStorage.queueForDeletion(storageKey);
        throw error;
      }

      return { createdNewVersion: true, fileAssetId: existing.id };
    });
  }
}
