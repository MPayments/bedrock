import { basename } from "node:path";

import { trimToNull, type ModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ValidationError } from "@bedrock/shared/core/errors";

import {
  buildUploadedFileStorageKey,
  mapStoredFileRecordToAttachment,
} from "./uploaded-file-artifacts";
import type { FileAttachment } from "../contracts/dto";
import type { FilesCommandUnitOfWork } from "../ports/files.uow";
import type { ObjectStoragePort } from "../ports/object-storage.port";

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
      const storageKey = buildUploadedFileStorageKey({
        fallbackFileStem: "signed-contract",
        fileAssetId,
        fileName: validated.fileName,
        linkKind: "agreement_signed_contract",
        ownerId: validated.versionId,
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

        return mapStoredFileRecordToAttachment(created);
      } catch (error) {
        await objectStorage.queueForDeletion(storageKey);
        throw error;
      }
    });
  }
}
