import type { FileAttachment } from "../contracts/dto";
import type {
  FileAttachmentPurpose,
  FileAttachmentVisibility,
  FileGeneratedFormat,
  FileGeneratedLang,
  FileLinkKind,
  FileOrigin,
} from "../contracts/zod";

export type FileOwnerType = "counterparty" | "deal" | "payment_step";

export interface StoredFileRecord {
  id: string;
  currentVersionId: string;
  currentVersionNumber: number;
  origin: FileOrigin;
  description: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  checksum: string;
  versionCreatedBy: string | null;
  versionCreatedAt: Date;
  versionUpdatedAt: Date;
  attachmentPurpose: FileAttachmentPurpose | null;
  attachmentVisibility: FileAttachmentVisibility | null;
  linkId: string;
  linkKind: FileLinkKind;
  dealId: string | null;
  counterpartyId: string | null;
  paymentStepId: string | null;
  generatedFormat: FileGeneratedFormat | null;
  generatedLang: FileGeneratedLang | null;
}

export interface FileVersionMetadata {
  assetId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface FileReads {
  findAttachmentByOwnerAndId(input: {
    fileAssetId: string;
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<StoredFileRecord | null>;
  findGeneratedByOwner(input: {
    generatedFormat: FileGeneratedFormat;
    generatedLang: FileGeneratedLang;
    linkKind: FileLinkKind;
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<StoredFileRecord | null>;
  findById(id: string): Promise<StoredFileRecord | null>;
  listAttachmentsByOwner(input: {
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<FileAttachment[]>;
  listCurrentFileVersionsByAssetIds(
    assetIds: string[],
  ): Promise<FileVersionMetadata[]>;
}
