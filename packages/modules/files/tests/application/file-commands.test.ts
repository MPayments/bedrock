import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { createTestLogger } from "@bedrock/test-utils";

import { DeleteFileAttachmentCommand } from "../../src/application/commands/delete-file-attachment";
import { UploadFileAttachmentCommand } from "../../src/application/commands/upload-file-attachment";
import { UpsertAgreementVersionSignedContractCommand } from "../../src/application/commands/upsert-agreement-version-signed-contract";

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
    attachmentVisibility: "internal" as const,
    linkId: "00000000-0000-4000-8000-000000000012",
    linkKind: "deal_attachment" as const,
    agreementVersionId: null,
    dealId: "deal-1",
    counterpartyId: null,
    paymentStepId: null,
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
      findLatestByOwnerAndKind: vi.fn(),
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
      attachmentVisibility: "internal",
      agreementVersionId: null,
      linkKind: "deal_attachment",
      dealId: "deal-1",
      counterpartyId: null,
      paymentStepId: null,
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
      visibility: "internal",
      uploadedBy: "user-1",
      description: "Uploaded attachment",
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    });
  });

  it("creates a new version when replacing an agreement signed contract", async () => {
    const buffer = Buffer.from("signed-contract-v2");
    const fileStore = {
      createFileAssetRoot: vi.fn(),
      createFileVersion: vi.fn(),
      createFileLink: vi.fn(),
      deleteFileAsset: vi.fn(),
      setCurrentVersion: vi.fn(),
    };
    const fileReads = {
      findAttachmentByOwnerAndId: vi.fn(),
      findLatestByOwnerAndKind: vi
        .fn()
        .mockResolvedValueOnce(
          createStoredFile({
            agreementVersionId: "version-1",
            attachmentPurpose: null,
            attachmentVisibility: null,
            checksum: "old-checksum",
            currentVersionNumber: 1,
            dealId: null,
            id: "00000000-0000-4000-8000-000000000020",
            linkKind: "agreement_signed_contract",
            storageKey:
              "files/uploaded/agreement_signed_contract/version-1/00000000-0000-4000-8000-000000000020/v1/contract.pdf",
          }),
        )
        .mockResolvedValueOnce(
          createStoredFile({
            agreementVersionId: "version-1",
            attachmentPurpose: null,
            attachmentVisibility: null,
            checksum: sha256Hex(buffer.toString("base64")),
            currentVersionNumber: 2,
            dealId: null,
            fileName: "signed.pdf",
            fileSize: buffer.byteLength,
            id: "00000000-0000-4000-8000-000000000020",
            linkKind: "agreement_signed_contract",
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
      upload: vi.fn(async () => "stored-key"),
      getSignedUrl: vi.fn(),
      queueForDeletion: vi.fn(),
    };
    const command = new UpsertAgreementVersionSignedContractCommand(
      createRuntime("files", ["00000000-0000-4000-8000-000000000021"]),
      commandUow as any,
      objectStorage,
    );

    const result = await command.execute({
      buffer,
      fileName: "signed.pdf",
      fileSize: buffer.byteLength,
      mimeType: "application/pdf",
      uploadedBy: "user-1",
      versionId: "version-1",
    });

    expect(fileStore.createFileAssetRoot).not.toHaveBeenCalled();
    expect(fileStore.createFileLink).not.toHaveBeenCalled();
    expect(fileStore.createFileVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        fileAssetId: "00000000-0000-4000-8000-000000000020",
        id: "00000000-0000-4000-8000-000000000021",
        versionNumber: 2,
      }),
    );
    expect(fileStore.setCurrentVersion).toHaveBeenCalledWith({
      fileAssetId: "00000000-0000-4000-8000-000000000020",
      currentVersionId: "00000000-0000-4000-8000-000000000021",
    });
    expect(result).toEqual({
      id: "00000000-0000-4000-8000-000000000020",
      fileName: "signed.pdf",
      fileSize: buffer.byteLength,
      mimeType: "application/pdf",
      purpose: null,
      visibility: null,
      uploadedBy: "user-1",
      description: "Uploaded attachment",
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    });
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
      findAttachmentByOwnerAndId: vi.fn(async () =>
        createStoredFile({
          attachmentVisibility: "internal",
        }),
      ),
      findLatestByOwnerAndKind: vi.fn(),
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
