import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { createTestLogger } from "@bedrock/test-utils";

import { DeleteFileAttachmentCommand } from "../../src/application/commands/delete-file-attachment";
import { PersistGeneratedFileCommand } from "../../src/application/commands/persist-generated-file";
import { UploadFileAttachmentCommand } from "../../src/application/commands/upload-file-attachment";

function createRuntime(service: string, uuids: string[]) {
  return createModuleRuntime({
    service,
    logger: createTestLogger(),
    generateUuid: () =>
      uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });
}

function createStoredFile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    currentVersionId: "00000000-0000-4000-8000-000000000011",
    currentVersionNumber: 1,
    origin: "uploaded" as const,
    description: "Uploaded attachment",
    createdBy: "user-1",
    createdAt: new Date("2026-03-30T12:00:00.000Z"),
    updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    fileName: "deal.pdf",
    fileSize: 42,
    mimeType: "application/pdf",
    storageKey:
      "files/uploaded/deal_attachment/deal-1/00000000-0000-4000-8000-000000000010/v1/deal.pdf",
    checksum: "checksum-1",
    versionCreatedBy: "user-1",
    versionCreatedAt: new Date("2026-03-30T12:00:00.000Z"),
    versionUpdatedAt: new Date("2026-03-30T12:00:00.000Z"),
    attachmentPurpose: "other" as const,
    linkId: "00000000-0000-4000-8000-000000000012",
    linkKind: "deal_attachment" as const,
    dealId: "deal-1",
    counterpartyId: null,
    generatedFormat: null,
    generatedLang: null,
    ...overrides,
  };
}

describe("files commands", () => {
  it("creates an uploaded attachment root, version, owner link, and current-version pointer", async () => {
    const fileStore = {
      createFileAssetRoot: vi.fn(),
      createFileVersion: vi.fn(),
      createFileLink: vi.fn(),
      deleteFileAsset: vi.fn(),
      setCurrentVersion: vi.fn(),
    };
    const fileReads = {
      findAttachmentByOwnerAndId: vi.fn(async () => createStoredFile()),
      findGeneratedByOwner: vi.fn(),
      findById: vi.fn(),
      listAttachmentsByOwner: vi.fn(),
    };
    const tx = { fileReads, fileStore, transaction: { id: "tx-1" } as any };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const objectStorage = {
      download: vi.fn(),
      upload: vi.fn(async () => "stored-key"),
      getSignedUrl: vi.fn(),
      queueForDeletion: vi.fn(),
    };
    const command = new UploadFileAttachmentCommand(
      createRuntime("files", [
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000011",
        "00000000-0000-4000-8000-000000000012",
      ]),
      commandUow as any,
      objectStorage,
      {
        linkKind: "deal_attachment",
        ownerType: "deal",
      },
    );

    const result = await command.execute({
      buffer: Buffer.from("deal-pdf"),
      description: "  Uploaded attachment  ",
      fileName: "deal.pdf",
      fileSize: 42,
      mimeType: "application/pdf",
      ownerId: "deal-1",
      uploadedBy: "user-1",
    });

    expect(objectStorage.upload).toHaveBeenCalledWith(
      "files/uploaded/deal_attachment/deal-1/00000000-0000-4000-8000-000000000010/v1/deal.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
    expect(fileStore.createFileAssetRoot).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000010",
      origin: "uploaded",
      description: "Uploaded attachment",
      createdBy: "user-1",
    });
    expect(fileStore.createFileVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000011",
        fileAssetId: "00000000-0000-4000-8000-000000000010",
        versionNumber: 1,
      }),
    );
    expect(fileStore.createFileLink).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000012",
      fileAssetId: "00000000-0000-4000-8000-000000000010",
      attachmentPurpose: "other",
      linkKind: "deal_attachment",
      dealId: "deal-1",
      counterpartyId: null,
      generatedFormat: null,
      generatedLang: null,
    });
    expect(fileStore.setCurrentVersion).toHaveBeenCalledWith({
      fileAssetId: "00000000-0000-4000-8000-000000000010",
      currentVersionId: "00000000-0000-4000-8000-000000000011",
    });
    expect(result).toEqual({
      id: "00000000-0000-4000-8000-000000000010",
      fileName: "deal.pdf",
      fileSize: 42,
      mimeType: "application/pdf",
      purpose: "other",
      uploadedBy: "user-1",
      description: "Uploaded attachment",
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    });
  });

  it("does not create a new generated version when the checksum is unchanged", async () => {
    const buffer = Buffer.from("generated-doc");
    const checksum = sha256Hex(buffer.toString("base64"));
    const fileStore = {
      createFileAssetRoot: vi.fn(),
      createFileVersion: vi.fn(),
      createFileLink: vi.fn(),
      deleteFileAsset: vi.fn(),
      setCurrentVersion: vi.fn(),
    };
    const fileReads = {
      findAttachmentByOwnerAndId: vi.fn(),
      findGeneratedByOwner: vi.fn(async () =>
        createStoredFile({
          checksum,
          currentVersionNumber: 3,
          id: "00000000-0000-4000-8000-000000000020",
          linkKind: "deal_invoice",
          generatedFormat: "pdf",
          generatedLang: "ru",
        }),
      ),
      findById: vi.fn(),
      listAttachmentsByOwner: vi.fn(),
    };
    const tx = { fileReads, fileStore, transaction: { id: "tx-1" } as any };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const objectStorage = {
      download: vi.fn(),
      upload: vi.fn(),
      getSignedUrl: vi.fn(),
      queueForDeletion: vi.fn(),
    };
    const command = new PersistGeneratedFileCommand(
      createRuntime("files", []),
      commandUow as any,
      objectStorage,
      "deal",
    );

    const result = await command.execute({
      buffer,
      createdBy: "user-1",
      fileName: "invoice.pdf",
      fileSize: buffer.byteLength,
      generatedFormat: "pdf",
      generatedLang: "ru",
      linkKind: "deal_invoice",
      mimeType: "application/pdf",
      ownerId: "deal-1",
    });

    expect(result).toEqual({
      createdNewVersion: false,
      fileAssetId: "00000000-0000-4000-8000-000000000020",
    });
    expect(objectStorage.upload).not.toHaveBeenCalled();
    expect(fileStore.createFileVersion).not.toHaveBeenCalled();
    expect(fileStore.setCurrentVersion).not.toHaveBeenCalled();
  });

  it("deletes uploaded attachments and queues blob cleanup", async () => {
    const fileStore = {
      createFileAssetRoot: vi.fn(),
      createFileVersion: vi.fn(),
      createFileLink: vi.fn(),
      deleteFileAsset: vi.fn(),
      setCurrentVersion: vi.fn(),
    };
    const fileReads = {
      findAttachmentByOwnerAndId: vi.fn(async () => createStoredFile()),
      findGeneratedByOwner: vi.fn(),
      findById: vi.fn(),
      listAttachmentsByOwner: vi.fn(),
    };
    const tx = { fileReads, fileStore, transaction: { id: "tx-1" } as any };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const objectStorage = {
      download: vi.fn(),
      upload: vi.fn(),
      getSignedUrl: vi.fn(),
      queueForDeletion: vi.fn(async () => undefined),
    };
    const command = new DeleteFileAttachmentCommand(
      commandUow as any,
      objectStorage,
      "deal",
    );

    await command.execute({
      fileAssetId: "00000000-0000-4000-8000-000000000010",
      ownerId: "deal-1",
    });

    expect(fileStore.deleteFileAsset).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000010",
    );
    expect(objectStorage.queueForDeletion).toHaveBeenCalledWith(
      "files/uploaded/deal_attachment/deal-1/00000000-0000-4000-8000-000000000010/v1/deal.pdf",
    );
  });
});
