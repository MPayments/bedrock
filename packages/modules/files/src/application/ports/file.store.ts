import type {
  FileGeneratedFormat,
  FileGeneratedLang,
  FileLinkKind,
  FileOrigin,
} from "../contracts/zod";

export interface CreateFileAssetRootInput {
  createdBy: string | null;
  description: string | null;
  id: string;
  origin: FileOrigin;
}

export interface CreateFileVersionStoredInput {
  checksum: string;
  createdBy: string | null;
  fileAssetId: string;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  storageKey: string;
  versionNumber: number;
}

export interface CreateFileLinkStoredInput {
  counterpartyId: string | null;
  dealId: string | null;
  fileAssetId: string;
  generatedFormat: FileGeneratedFormat | null;
  generatedLang: FileGeneratedLang | null;
  id: string;
  linkKind: FileLinkKind;
}

export interface FileStore {
  createFileAssetRoot(input: CreateFileAssetRootInput): Promise<void>;
  createFileLink(input: CreateFileLinkStoredInput): Promise<void>;
  createFileVersion(input: CreateFileVersionStoredInput): Promise<void>;
  deleteFileAsset(id: string): Promise<void>;
  setCurrentVersion(input: {
    currentVersionId: string;
    fileAssetId: string;
  }): Promise<void>;
}
