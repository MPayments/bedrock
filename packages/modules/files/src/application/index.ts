import type { ModuleRuntime } from "@bedrock/shared/core";

import { DeleteFileAttachmentCommand } from "./commands/delete-file-attachment";
import { PersistGeneratedFileCommand } from "./commands/persist-generated-file";
import { UploadFileAttachmentCommand } from "./commands/upload-file-attachment";
import type { FileReads } from "./ports/file.reads";
import type { FilesCommandUnitOfWork } from "./ports/files.uow";
import type { ObjectStoragePort } from "./ports/object-storage.port";
import { GetFileAttachmentContentQuery } from "./queries/get-file-attachment-content";
import { GetFileDownloadUrlQuery } from "./queries/get-file-download-url";
import { ListFileAttachmentsQuery } from "./queries/list-file-attachments";

export interface FilesServiceDeps {
  commandUow: FilesCommandUnitOfWork;
  objectStorage?: ObjectStoragePort;
  reads: FileReads;
  runtime: ModuleRuntime;
}

export function createFilesService(deps: FilesServiceDeps) {
  const listDealAttachments = new ListFileAttachmentsQuery(deps.reads, "deal");
  const listCounterpartyAttachments = new ListFileAttachmentsQuery(
    deps.reads,
    "counterparty",
  );
  const getDealDownloadUrl = new GetFileDownloadUrlQuery(
    deps.reads,
    deps.objectStorage,
    "deal",
  );
  const getDealAttachmentContent = new GetFileAttachmentContentQuery(
    deps.reads,
    deps.objectStorage,
    "deal",
  );
  const getCounterpartyDownloadUrl = new GetFileDownloadUrlQuery(
    deps.reads,
    deps.objectStorage,
    "counterparty",
  );
  const getCounterpartyAttachmentContent = new GetFileAttachmentContentQuery(
    deps.reads,
    deps.objectStorage,
    "counterparty",
  );
  const uploadDealAttachment = new UploadFileAttachmentCommand(
    deps.runtime,
    deps.commandUow,
    deps.objectStorage,
    {
      linkKind: "deal_attachment",
      ownerType: "deal",
    },
  );
  const uploadCounterpartyAttachment = new UploadFileAttachmentCommand(
    deps.runtime,
    deps.commandUow,
    deps.objectStorage,
    {
      linkKind: "legal_entity_attachment",
      ownerType: "counterparty",
    },
  );
  const deleteDealAttachment = new DeleteFileAttachmentCommand(
    deps.commandUow,
    deps.objectStorage,
    "deal",
  );
  const deleteCounterpartyAttachment = new DeleteFileAttachmentCommand(
    deps.commandUow,
    deps.objectStorage,
    "counterparty",
  );
  const persistGeneratedDealFile = new PersistGeneratedFileCommand(
    deps.runtime,
    deps.commandUow,
    deps.objectStorage,
    "deal",
  );
  const persistGeneratedCounterpartyFile = new PersistGeneratedFileCommand(
    deps.runtime,
    deps.commandUow,
    deps.objectStorage,
    "counterparty",
  );

  return {
    commands: {
      deleteDealAttachment: deleteDealAttachment.execute.bind(deleteDealAttachment),
      deleteCounterpartyAttachment:
        deleteCounterpartyAttachment.execute.bind(deleteCounterpartyAttachment),
      persistGeneratedDealFile:
        persistGeneratedDealFile.execute.bind(persistGeneratedDealFile),
      persistGeneratedCounterpartyFile:
        persistGeneratedCounterpartyFile.execute.bind(
          persistGeneratedCounterpartyFile,
        ),
      uploadDealAttachment:
        uploadDealAttachment.execute.bind(uploadDealAttachment),
      uploadCounterpartyAttachment:
        uploadCounterpartyAttachment.execute.bind(uploadCounterpartyAttachment),
    },
    queries: {
      getCounterpartyAttachmentDownloadUrl:
        getCounterpartyDownloadUrl.execute.bind(getCounterpartyDownloadUrl),
      getCounterpartyAttachmentContent:
        getCounterpartyAttachmentContent.execute.bind(
          getCounterpartyAttachmentContent,
        ),
      getDealAttachmentDownloadUrl:
        getDealDownloadUrl.execute.bind(getDealDownloadUrl),
      getDealAttachmentContent:
        getDealAttachmentContent.execute.bind(getDealAttachmentContent),
      listCounterpartyAttachments:
        listCounterpartyAttachments.execute.bind(listCounterpartyAttachments),
      listCurrentFileVersionsByAssetIds: (assetIds: string[]) =>
        deps.reads.listCurrentFileVersionsByAssetIds(assetIds),
      listDealAttachments: listDealAttachments.execute.bind(listDealAttachments),
    },
  };
}

export type FilesService = ReturnType<typeof createFilesService>;
