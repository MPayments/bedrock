import { basename, extname } from "node:path";

import type { FileAttachment } from "../contracts/dto";
import type { FileLinkKind } from "../contracts/zod";
import type { StoredFileRecord } from "../ports/file.reads";

function sanitizeUploadedFileName(input: string, fallbackStem: string): string {
  const ext = extname(input);
  const stem = basename(input, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${stem || fallbackStem}${ext.replace(/[^a-zA-Z0-9.]+/g, "")}`;
}

export function buildUploadedFileStorageKey(input: {
  fallbackFileStem: string;
  fileAssetId: string;
  fileName: string;
  linkKind: FileLinkKind;
  ownerId: string;
  versionNumber: number;
}) {
  return [
    "files",
    "uploaded",
    input.linkKind,
    input.ownerId,
    input.fileAssetId,
    `v${input.versionNumber}`,
    sanitizeUploadedFileName(input.fileName, input.fallbackFileStem),
  ].join("/");
}

export function mapStoredFileRecordToAttachment(
  file: StoredFileRecord,
): FileAttachment {
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
