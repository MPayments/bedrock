import { basename, extname } from "node:path";

import { trimToNull } from "@bedrock/shared/core";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { FileAttachment } from "../contracts/dto";
import type {
  FileAttachmentVisibility,
  FileLinkKind,
} from "../contracts/zod";
import type {
  FileOwnerType,
  StoredFileRecord,
} from "../ports/file.reads";
import type { FilesCommandUnitOfWork } from "../ports/files.uow";
import type { ObjectStoragePort } from "../ports/object-storage.port";

const UploadedAttachmentMetadataSchema = {
  parse(input: {
    attachmentVisibility?: FileAttachmentVisibility | null;
    description?: string | null;
    fileName: string;
    fileSize: number;
    mimeType: string;
    ownerId: string;
    uploadedBy: string | null;
  }) {
    const fileName = basename(input.fileName).trim();
    if (fileName.length === 0) {
      throw new ValidationError("fileName is required");
    }
    if (!Number.isInteger(input.fileSize) || input.fileSize < 0) {
      throw new ValidationError("fileSize must be a non-negative integer");
    }
    if (input.mimeType.trim().length === 0) {
      throw new ValidationError("mimeType is required");
    }
    if (input.ownerId.trim().length === 0) {
      throw new ValidationError("ownerId is required");
    }

    return {
      ...input,
      attachmentVisibility: input.attachmentVisibility ?? "internal",
      description: trimToNull(input.description) ?? null,
      fileName,
      mimeType: input.mimeType.trim(),
      ownerId: input.ownerId.trim(),
      uploadedBy: trimToNull(input.uploadedBy) ?? null,
    };
  },
};

function sanitizeFileStem(input: string): string {
  const ext = extname(input);
  const stem = basename(input, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${stem || "file"}${ext.replace(/[^a-zA-Z0-9.]+/g, "")}`;
}

function buildStorageKey(input: {
  fileAssetId: string;
  fileName: string;
  linkKind: FileLinkKind;
  ownerId: string;
}) {
  return [
    "files",
    "uploaded",
    input.linkKind,
    input.ownerId,
    input.fileAssetId,
    "v1",
    sanitizeFileStem(input.fileName),
  ].join("/");
}

function mapFileRecordToAttachment(file: StoredFileRecord): FileAttachment {
  return {
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    visibility: file.attachmentVisibility,
    uploadedBy: file.versionCreatedBy,
    description: file.description,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export class UploadFileAttachmentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: FilesCommandUnitOfWork,
    private readonly objectStorage: ObjectStoragePort | undefined,
    private readonly options: {
      linkKind: FileLinkKind;
      ownerType: FileOwnerType;
    },
  ) {}

  async execute(input: {
    attachmentVisibility?: FileAttachmentVisibility | null;
    buffer: Buffer;
    description?: string | null;
    fileName: string;
    fileSize: number;
    mimeType: string;
    ownerId: string;
    uploadedBy: string | null;
  }): Promise<FileAttachment> {
    if (!this.objectStorage) {
      throw new ValidationError("File storage is not configured");
    }

    const validated = UploadedAttachmentMetadataSchema.parse(input);
    const fileAssetId = this.runtime.generateUuid();
    const versionId = this.runtime.generateUuid();
    const linkId = this.runtime.generateUuid();
    const checksum = sha256Hex(input.buffer.toString("base64"));
    const storageKey = buildStorageKey({
      fileAssetId,
      fileName: validated.fileName,
      linkKind: this.options.linkKind,
      ownerId: validated.ownerId,
    });

    await this.objectStorage.upload(storageKey, input.buffer, validated.mimeType);

    try {
      return await this.commandUow.run(async (tx) => {
        await tx.fileStore.createFileAssetRoot({
          id: fileAssetId,
          origin: "uploaded",
          description: validated.description,
          createdBy: validated.uploadedBy,
        });
        await tx.fileStore.createFileVersion({
          id: versionId,
          fileAssetId,
          versionNumber: 1,
          fileName: validated.fileName,
          fileSize: validated.fileSize,
          mimeType: validated.mimeType,
          storageKey,
          checksum,
          createdBy: validated.uploadedBy,
        });
        await tx.fileStore.createFileLink({
          attachmentVisibility: validated.attachmentVisibility,
          id: linkId,
          fileAssetId,
          linkKind: this.options.linkKind,
          dealId: this.options.ownerType === "deal" ? validated.ownerId : null,
          counterpartyId:
            this.options.ownerType === "counterparty" ? validated.ownerId : null,
          generatedFormat: null,
          generatedLang: null,
        });
        await tx.fileStore.setCurrentVersion({
          fileAssetId,
          currentVersionId: versionId,
        });

        const created = await tx.fileReads.findAttachmentByOwnerAndId({
          fileAssetId,
          ownerId: validated.ownerId,
          ownerType: this.options.ownerType,
        });

        if (!created) {
          throw new ValidationError(
            `Uploaded file ${fileAssetId} was not created`,
          );
        }

        return mapFileRecordToAttachment(created);
      });
    } catch (error) {
      await this.objectStorage.queueForDeletion(storageKey);
      throw error;
    }
  }
}
