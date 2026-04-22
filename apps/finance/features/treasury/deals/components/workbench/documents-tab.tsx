import Link from "next/link";
import { Download, File, FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  getApprovalStatusLabel,
  getPostingStatusLabel,
  getSubmissionStatusLabel,
} from "@/features/documents/lib/status-labels";
import {
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import {
  formatDealWorkflowMessage,
  getAttachmentVisibilityLabel,
  getDealAttachmentRequirementStateLabel,
  getDealFormalDocumentRequirementStateLabel,
  getFormalDocumentLabel,
  getFormalDocumentStageLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { formatDate } from "@/lib/format";

import { formatFileSize, getFileIcon } from "../file-utils";

export type DocumentsTabProps = {
  deal: FinanceDealWorkbench;
  deletingAttachmentId: string | null;
  documentsTabReturnTo: string;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
};

export function DocumentsTab({
  deal,
  deletingAttachmentId,
  documentsTabReturnTo,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentUpload,
}: DocumentsTabProps) {
  const activeRequiredDocumentIds = new Set(
    deal.formalDocumentRequirements
      .map((requirement) => requirement.activeDocumentId)
      .filter((documentId): documentId is string => Boolean(documentId)),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Что нужно приложить
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deal.attachmentRequirements.map((requirement) => (
              <div key={requirement.code} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{requirement.label}</div>
                  <span className="text-sm text-muted-foreground">
                    {getDealAttachmentRequirementStateLabel(requirement.state)}
                  </span>
                </div>
                {requirement.blockingReasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {requirement.blockingReasons.map((reason) => (
                      <li key={reason}>{formatDealWorkflowMessage(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              Подтверждающие файлы
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!deal.actions.canUploadAttachment}
              onClick={onAttachmentUpload}
            >
              <Upload className="mr-2 h-4 w-4" />
              Загрузить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deal.relatedResources.attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По сделке пока нет загруженных вложений.
            </div>
          ) : (
            <div className="space-y-2">
              {deal.relatedResources.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="shrink-0">
                      {getFileIcon(attachment.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {attachment.fileName}
                      </div>
                      {attachment.description ? (
                        <div className="truncate text-sm text-muted-foreground">
                          {attachment.description}
                        </div>
                      ) : null}
                      <div className="mt-1">
                        <Badge variant="outline">
                          {getAttachmentVisibilityLabel(attachment.visibility)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.fileSize)} ·{" "}
                        {formatDate(attachment.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      className="h-8 w-8 p-0"
                      size="sm"
                      title="Скачать"
                      variant="ghost"
                      onClick={() => onAttachmentDownload(attachment.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      size="sm"
                      title="Удалить"
                      variant="ghost"
                      disabled={deletingAttachmentId === attachment.id}
                      onClick={() => onAttachmentDelete(attachment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            Внутренние документы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {deal.formalDocumentRequirements.map((requirement) => {
              const createHref = requirement.createAllowed
                ? buildDocumentCreateHref(requirement.docType, {
                    dealId: deal.summary.id,
                    returnTo: documentsTabReturnTo,
                  })
                : null;
              const openHref =
                requirement.openAllowed && requirement.activeDocumentId
                  ? buildDocumentDetailsHref(
                      requirement.docType,
                      requirement.activeDocumentId,
                    )
                  : null;
              const actionHref = createHref ?? openHref;

              return (
                <div
                  key={`${requirement.stage}:${requirement.docType}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {getFormalDocumentLabel(requirement.docType)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getFormalDocumentStageLabel(requirement.stage)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {actionHref ? (
                        <Button
                          data-testid={`finance-deal-formal-document-action-${requirement.stage}-${requirement.docType}`}
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={actionHref} />}
                        >
                          {createHref ? "Создать" : "Открыть"}
                        </Button>
                      ) : null}
                      <Badge
                        data-testid={`finance-deal-formal-document-state-${requirement.stage}-${requirement.docType}`}
                        variant="outline"
                      >
                        {getDealFormalDocumentRequirementStateLabel(
                          requirement.state,
                        )}
                      </Badge>
                    </div>
                  </div>
                  {requirement.blockingReasons.length > 0 ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {requirement.blockingReasons
                        .map((reason) => formatDealWorkflowMessage(reason))
                        .join(" ")}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {deal.relatedResources.formalDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По сделке еще нет формальных документов.
            </div>
          ) : (
            <div className="space-y-3">
              {deal.relatedResources.formalDocuments.map((document) => {
                const href = buildDocumentDetailsHref(
                  document.docType,
                  document.id,
                );
                const showOpenAction =
                  href !== null && !activeRequiredDocumentIds.has(document.id);

                return (
                  <div key={document.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium">
                          {getFormalDocumentLabel(document.docType)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(
                            document.createdAt ?? document.occurredAt ?? "",
                          )}
                        </div>
                      </div>
                      {showOpenAction ? (
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={href} />}
                        >
                          Открыть
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {document.submissionStatus ? (
                        <Badge variant="outline">
                          Отправка:{" "}
                          {getSubmissionStatusLabel(document.submissionStatus)}
                        </Badge>
                      ) : null}
                      {document.approvalStatus ? (
                        <Badge variant="outline">
                          Согласование:{" "}
                          {getApprovalStatusLabel(document.approvalStatus)}
                        </Badge>
                      ) : null}
                      {document.postingStatus ? (
                        <Badge variant="outline">
                          Проведение:{" "}
                          {getPostingStatusLabel(document.postingStatus)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
