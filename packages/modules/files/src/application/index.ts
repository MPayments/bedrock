import type { ModuleRuntime } from "@bedrock/shared/core";

import { DeleteFileAttachmentCommand } from "./commands/delete-file-attachment";
import { UploadFileAttachmentCommand } from "./commands/upload-file-attachment";
import { UpsertAgreementVersionSignedContractCommand } from "./commands/upsert-agreement-version-signed-contract";
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
  const getAgreementVersionSignedContractDownloadUrl =
    new GetFileDownloadUrlQuery(
      deps.reads,
      deps.objectStorage,
      "agreement_version",
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
  const uploadPaymentStepAttachment = new UploadFileAttachmentCommand(
    deps.runtime,
    deps.commandUow,
    deps.objectStorage,
    {
      linkKind: "payment_step_evidence",
      ownerType: "payment_step",
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
  const upsertAgreementVersionSignedContract =
    new UpsertAgreementVersionSignedContractCommand(
      deps.runtime,
      deps.commandUow,
      deps.objectStorage,
    );

  return {
    commands: {
      deleteDealAttachment: deleteDealAttachment.execute.bind(deleteDealAttachment),
      deleteCounterpartyAttachment:
        deleteCounterpartyAttachment.execute.bind(deleteCounterpartyAttachment),
      uploadDealAttachment:
        uploadDealAttachment.execute.bind(uploadDealAttachment),
      uploadCounterpartyAttachment:
        uploadCounterpartyAttachment.execute.bind(uploadCounterpartyAttachment),
      uploadPaymentStepAttachment: uploadPaymentStepAttachment.execute.bind(
        uploadPaymentStepAttachment,
      ),
      upsertAgreementVersionSignedContract:
        upsertAgreementVersionSignedContract.execute.bind(
          upsertAgreementVersionSignedContract,
        ),
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
      findAgreementVersionSignedContract: (versionId: string) =>
        deps.reads.findLatestByOwnerAndKind({
          linkKind: "agreement_signed_contract",
          ownerId: versionId,
          ownerType: "agreement_version",
        }),
      getAgreementVersionSignedContractDownloadUrl: (input: {
        fileAssetId: string;
        versionId: string;
      }) =>
        getAgreementVersionSignedContractDownloadUrl.execute({
          fileAssetId: input.fileAssetId,
          ownerId: input.versionId,
        }),
    },
  };
}

export type FilesService = ReturnType<typeof createFilesService>;
