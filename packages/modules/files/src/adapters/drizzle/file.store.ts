import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { fileAssets, fileLinks, fileVersions } from "./schema";
import type {
  CreateFileAssetRootInput,
  CreateFileLinkStoredInput,
  CreateFileVersionStoredInput,
  FileStore,
} from "../../application/ports/file.store";

export class DrizzleFileStore implements FileStore {
  constructor(private readonly db: Queryable) {}

  async createFileAssetRoot(input: CreateFileAssetRootInput): Promise<void> {
    await this.db.insert(fileAssets).values({
      id: input.id,
      currentVersionId: null,
      origin: input.origin,
      description: input.description,
      createdBy: input.createdBy,
    });
  }

  async createFileLink(input: CreateFileLinkStoredInput): Promise<void> {
    await this.db.insert(fileLinks).values({
      id: input.id,
      fileAssetId: input.fileAssetId,
      dealId: input.dealId,
      counterpartyId: input.counterpartyId,
      linkKind: input.linkKind,
      generatedFormat: input.generatedFormat,
      generatedLang: input.generatedLang,
    });
  }

  async createFileVersion(input: CreateFileVersionStoredInput): Promise<void> {
    await this.db.insert(fileVersions).values({
      id: input.id,
      fileAssetId: input.fileAssetId,
      versionNumber: input.versionNumber,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storageKey: input.storageKey,
      checksum: input.checksum,
      createdBy: input.createdBy,
    });
  }

  async deleteFileAsset(id: string): Promise<void> {
    await this.db.delete(fileAssets).where(eq(fileAssets.id, id));
  }

  async setCurrentVersion(input: {
    currentVersionId: string;
    fileAssetId: string;
  }): Promise<void> {
    await this.db
      .update(fileAssets)
      .set({
        currentVersionId: input.currentVersionId,
        updatedAt: sql`now()`,
      })
      .where(eq(fileAssets.id, input.fileAssetId));
  }
}
