import { basename, extname } from "node:path";

import { trimToNull, type ModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { FileAttachment } from "../contracts/dto";
import type { StoredFileRecord } from "../ports/file.reads";
import type { FilesCommandUnitOfWork } from "../ports/files.uow";
import type { ObjectStoragePort } from "../ports/object-storage.port";

function sanitizeFileStem(input: string): string {
  const ext = extname(input);
  const stem = basename(input, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${stem || "signed-contract"}${ext.replace(/[^a-zA-Z0-9.]+/g, "")}`;
}

function validateInput(input: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string | null;
  versionId: string;
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
  if (input.versionId.trim().length === 0) {
    throw new ValidationError("versionId is required");
  }

  return {
    fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType.trim(),
    uploadedBy: trimToNull(input.uploadedBy) ?? null,
    versionId: input.versionId.trim(),
  };
}

function buildStorageKey(input: {
  agreementVersionId: string;
  fileAssetId: string;
  fileName: string;
  versionNumber: number;
}) {
  return [
    "files",
    "uploaded",
    "agreement_signed_contract",
    input.agreementVersionId,
    input.fileAssetId,
    `v${input.versionNumber}`,
    sanitizeFileStem(input.fileName),
  ].join("/");
}

function mapFileRecordToAttachment(file: StoredFileRecord): FileAttachment {
  return {
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    purpose: file.attachmentPurpose,
    visibility: file.attachmentVisibility,
    uploadedBy: file.versionCreatedBy,
    description: file.description,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export class UpsertAgreementVersionSignedContractCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: FilesCommandUnitOfWork,
    private readonly objectStorage: ObjectStoragePort | undefined,
  ) {}

  async execute(input: {
    buffer: Buffer;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string | null;
    versionId: string;
  }): Promise<FileAttachment> {
    if (!this.objectStorage) {
      throw new ValidationError("File storage is not configured");
    }

    const validated = validateInput(input);
    const checksum = sha256Hex(input.buffer.toString("base64"));
    const objectStorage = this.objectStorage;

    return this.commandUow.run(async (tx) => {
      const existing = await tx.fileReads.findLatestByOwnerAndKind({
        linkKind: "agreement_signed_contract",
        ownerId: validated.versionId,
        ownerType: "agreement_version",
      });
      const fileAssetId = existing?.id ?? this.runtime.generateUuid();
      const nextVersionNumber = existing
        ? existing.currentVersionNumber + 1
        : 1;
      const versionId = this.runtime.generateUuid();
      const storageKey = buildStorageKey({
        agreementVersionId: validated.versionId,
        fileAssetId,
        fileName: validated.fileName,
        versionNumber: nextVersionNumber,
      });

      await objectStorage.upload(storageKey, input.buffer, validated.mimeType);

      try {
        if (!existing) {
          await tx.fileStore.createFileAssetRoot({
            id: fileAssetId,
            origin: "uploaded",
            description: null,
            createdBy: validated.uploadedBy,
          });
        }

        await tx.fileStore.createFileVersion({
          id: versionId,
          fileAssetId,
          versionNumber: nextVersionNumber,
          fileName: validated.fileName,
          fileSize: validated.fileSize,
          mimeType: validated.mimeType,
          storageKey,
          checksum,
          createdBy: validated.uploadedBy,
        });

        if (!existing) {
          await tx.fileStore.createFileLink({
            agreementVersionId: validated.versionId,
            attachmentPurpose: null,
            attachmentVisibility: null,
            counterpartyId: null,
            dealId: null,
            fileAssetId,
            generatedFormat: null,
            generatedLang: null,
            id: this.runtime.generateUuid(),
            linkKind: "agreement_signed_contract",
            paymentStepId: null,
          });
        }

        await tx.fileStore.setCurrentVersion({
          fileAssetId,
          currentVersionId: versionId,
        });

        const created = await tx.fileReads.findLatestByOwnerAndKind({
          linkKind: "agreement_signed_contract",
          ownerId: validated.versionId,
          ownerType: "agreement_version",
        });

        if (!created) {
          throw new ValidationError(
            `Signed contract ${fileAssetId} was not created`,
          );
        }

        return mapFileRecordToAttachment(created);
      } catch (error) {
        await objectStorage.queueForDeletion(storageKey);
        throw error;
      }
    });
  }
}
