import { and, desc, eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { fileAssets, fileLinks, fileVersions } from "./schema";
import type { FileAttachment } from "../../application/contracts/dto";
import type {
  FileOwnerType,
  FileReads,
  FileVersionMetadata,
  StoredFileRecord,
} from "../../application/ports/file.reads";

const ATTACHMENT_LINK_KINDS = ["deal_attachment", "legal_entity_attachment"] as const;

function mapStoredFile(row: {
  id: string;
  currentVersionId: string | null;
  currentVersionNumber: number;
  origin: "generated" | "uploaded";
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
  attachmentPurpose: "invoice" | "contract" | "other" | null;
  attachmentVisibility: "customer_safe" | "internal" | null;
  linkId: string;
  linkKind:
    | "deal_acceptance"
    | "deal_application"
    | "deal_attachment"
    | "deal_invoice"
    | "legal_entity_attachment"
    | "legal_entity_contract";
  dealId: string | null;
  counterpartyId: string | null;
  generatedFormat: "docx" | "pdf" | null;
  generatedLang: "en" | "ru" | null;
}): StoredFileRecord {
  if (!row.currentVersionId) {
    throw new Error(`File asset ${row.id} is missing current_version_id`);
  }

  return {
    id: row.id,
    currentVersionId: row.currentVersionId,
    currentVersionNumber: row.currentVersionNumber,
    origin: row.origin,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    checksum: row.checksum,
    versionCreatedBy: row.versionCreatedBy,
    versionCreatedAt: row.versionCreatedAt,
    versionUpdatedAt: row.versionUpdatedAt,
    attachmentPurpose: row.attachmentPurpose,
    attachmentVisibility: row.attachmentVisibility,
    linkId: row.linkId,
    linkKind: row.linkKind,
    dealId: row.dealId,
    counterpartyId: row.counterpartyId,
    generatedFormat: row.generatedFormat,
    generatedLang: row.generatedLang,
  };
}

function mapAttachment(row: StoredFileRecord): FileAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    purpose: row.attachmentPurpose,
    visibility: row.attachmentVisibility,
    uploadedBy: row.versionCreatedBy,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFileReads implements FileReads {
  constructor(private readonly db: Queryable) {}

  async findAttachmentByOwnerAndId(input: {
    fileAssetId: string;
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<StoredFileRecord | null> {
    const [row] = await this.baseQuery()
      .where(
        and(
          eq(fileAssets.id, input.fileAssetId),
          inArray(fileLinks.linkKind, ATTACHMENT_LINK_KINDS),
          input.ownerType === "deal"
            ? eq(fileLinks.dealId, input.ownerId)
            : eq(fileLinks.counterpartyId, input.ownerId),
        ),
      )
      .limit(1);

    return row ? mapStoredFile(row) : null;
  }

  async findById(id: string): Promise<StoredFileRecord | null> {
    const [row] = await this.baseQuery()
      .where(eq(fileAssets.id, id))
      .limit(1);

    return row ? mapStoredFile(row) : null;
  }

  async findGeneratedByOwner(input: {
    generatedFormat: "docx" | "pdf";
    generatedLang: "en" | "ru";
    linkKind:
      | "deal_acceptance"
      | "deal_application"
      | "deal_attachment"
      | "deal_invoice"
      | "legal_entity_attachment"
      | "legal_entity_contract";
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<StoredFileRecord | null> {
    const [row] = await this.baseQuery()
      .where(
        and(
          eq(fileLinks.linkKind, input.linkKind),
          eq(fileLinks.generatedFormat, input.generatedFormat),
          eq(fileLinks.generatedLang, input.generatedLang),
          input.ownerType === "deal"
            ? eq(fileLinks.dealId, input.ownerId)
            : eq(fileLinks.counterpartyId, input.ownerId),
        ),
      )
      .limit(1);

    return row ? mapStoredFile(row) : null;
  }

  async listCurrentFileVersionsByAssetIds(
    assetIds: string[],
  ): Promise<FileVersionMetadata[]> {
    if (assetIds.length === 0) return [];
    const rows = await this.db
      .select({
        assetId: fileAssets.id,
        fileName: fileVersions.fileName,
        fileSize: fileVersions.fileSize,
        mimeType: fileVersions.mimeType,
      })
      .from(fileAssets)
      .innerJoin(
        fileVersions,
        eq(fileVersions.id, fileAssets.currentVersionId),
      )
      .where(inArray(fileAssets.id, assetIds));
    return rows.map((row) => ({
      assetId: row.assetId,
      fileName: row.fileName,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
    }));
  }

  async listAttachmentsByOwner(input: {
    ownerId: string;
    ownerType: FileOwnerType;
  }): Promise<FileAttachment[]> {
    const rows = await this.baseQuery()
      .where(
        and(
          inArray(fileLinks.linkKind, ATTACHMENT_LINK_KINDS),
          input.ownerType === "deal"
            ? eq(fileLinks.dealId, input.ownerId)
            : eq(fileLinks.counterpartyId, input.ownerId),
        ),
      )
      .orderBy(desc(fileAssets.createdAt), desc(fileAssets.id));

    return rows.map((row) => mapAttachment(mapStoredFile(row)));
  }

  private baseQuery() {
    return this.db
      .select({
        id: fileAssets.id,
        currentVersionId: fileAssets.currentVersionId,
        currentVersionNumber: fileVersions.versionNumber,
        origin: fileAssets.origin,
        description: fileAssets.description,
        createdBy: fileAssets.createdBy,
        createdAt: fileAssets.createdAt,
        updatedAt: fileAssets.updatedAt,
        fileName: fileVersions.fileName,
        fileSize: fileVersions.fileSize,
        mimeType: fileVersions.mimeType,
        storageKey: fileVersions.storageKey,
        checksum: fileVersions.checksum,
        versionCreatedBy: fileVersions.createdBy,
        versionCreatedAt: fileVersions.createdAt,
        versionUpdatedAt: fileVersions.updatedAt,
        attachmentPurpose: fileLinks.attachmentPurpose,
        attachmentVisibility: fileLinks.attachmentVisibility,
        linkId: fileLinks.id,
        linkKind: fileLinks.linkKind,
        dealId: fileLinks.dealId,
        counterpartyId: fileLinks.counterpartyId,
        generatedFormat: fileLinks.generatedFormat,
        generatedLang: fileLinks.generatedLang,
      })
      .from(fileAssets)
      .innerJoin(fileLinks, eq(fileLinks.fileAssetId, fileAssets.id))
      .innerJoin(fileVersions, eq(fileVersions.id, fileAssets.currentVersionId));
  }
}
