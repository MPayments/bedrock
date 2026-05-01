import { Download, Paperclip, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import {
  ATTACHMENT_INGESTION_STATUS_LABELS,
  ATTACHMENT_PURPOSE_LABELS,
  ATTACHMENT_VISIBILITY_LABELS,
} from "./constants";
import { formatDate } from "./format";
import { formatFileSize, getFileIcon } from "./file-utils";
import type { ApiAttachment, ApiDealAttachmentIngestion } from "./types";

type AttachmentsCardProps = {
  attachments: ApiAttachment[];
  attachmentIngestions: ApiDealAttachmentIngestion[];
  deletingAttachmentId: string | null;
  emptyText?: string;
  reingestingAttachmentId: string | null;
  title?: string;
  onUpload: () => void;
  onDownload: (attachmentId: string) => void;
  onDelete: (attachmentId: string) => void;
  onReingest: (attachmentId: string) => void;
};

type IngestionViewStatus =
  | "applied"
  | "failed"
  | "not_started"
  | "pending"
  | "processed_without_changes"
  | "processing"
  | "unavailable";

function getIngestionFailureDescription(ingestion: ApiDealAttachmentIngestion) {
  switch (ingestion.errorCode) {
    case "unsupported_mime_type":
      return "Этот тип файла пока не поддерживается для автораспознавания.";
    case "attachment_ineligible":
      return "Этот файл не подходит для автораспознавания.";
    case "revision_conflict":
      return "Данные сделки изменились во время обработки. Попробуйте повторить распознавание.";
    case "extractor_unconfigured":
    case "storage_unconfigured":
      return "Автораспознавание временно недоступно.";
    default:
      return "Не удалось распознать файл. Попробуйте повторить позже.";
  }
}

function getIngestionView(ingestion: ApiDealAttachmentIngestion | null): {
  description: string | null;
  status: IngestionViewStatus;
} | null {
  if (!ingestion) {
    return null;
  }

  if (ingestion.status === "pending") {
    return {
      description: null,
      status: "pending",
    };
  }

  if (ingestion.status === "processing") {
    return {
      description: null,
      status: "processing",
    };
  }

  if (ingestion.status === "processed") {
    if (ingestion.appliedFields.length === 0) {
      return {
        description: null,
        status: "processed_without_changes",
      };
    }

    return {
      description: `Заполнено полей: ${ingestion.appliedFields.length}`,
      status: "applied",
    };
  }

  if (
    ingestion.errorCode === "extractor_unconfigured" ||
    ingestion.errorCode === "storage_unconfigured"
  ) {
    return {
      description: null,
      status: "unavailable",
    };
  }

  return {
    description: getIngestionFailureDescription(ingestion),
    status: "failed",
  };
}

function getMissingIngestionView(input: { purpose: ApiAttachment["purpose"] }) {
  if (input.purpose !== "invoice" && input.purpose !== "contract") {
    return null;
  }

  return {
    description: null,
    status: "not_started" as const,
  };
}

function isActiveIngestionStatus(status: IngestionViewStatus) {
  return status === "pending" || status === "processing";
}

export function AttachmentsCard({
  attachments,
  attachmentIngestions,
  deletingAttachmentId,
  emptyText = "По сделке пока нет загруженных вложений.",
  reingestingAttachmentId,
  title = "Подтверждающие файлы",
  onUpload,
  onDownload,
  onDelete,
  onReingest,
}: AttachmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <AttachmentListHeader onUpload={onUpload} title={title} />
      </CardHeader>
      <CardContent>
        <AttachmentListContent
          attachmentIngestions={attachmentIngestions}
          attachments={attachments}
          deletingAttachmentId={deletingAttachmentId}
          emptyText={emptyText}
          onDelete={onDelete}
          onDownload={onDownload}
          onReingest={onReingest}
          reingestingAttachmentId={reingestingAttachmentId}
        />
      </CardContent>
    </Card>
  );
}

function AttachmentListHeader({
  onUpload,
  title,
}: {
  onUpload: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2">
        <Paperclip className="h-5 w-5 text-muted-foreground" />
        {title}
      </CardTitle>
      <Button
        data-testid="deal-upload-attachment-button"
        onClick={onUpload}
        size="sm"
        variant="outline"
      >
        <Upload className="mr-2 h-4 w-4" />
        Загрузить
      </Button>
    </div>
  );
}

function AttachmentListContent({
  attachments,
  attachmentIngestions,
  deletingAttachmentId,
  emptyText,
  reingestingAttachmentId,
  onDownload,
  onDelete,
  onReingest,
}: Omit<AttachmentsCardProps, "onUpload" | "title"> & {
  emptyText: string;
}) {
  const ingestionsByAttachmentId = new Map(
    attachmentIngestions.map((ingestion) => [ingestion.fileAssetId, ingestion]),
  );

  return (
    <>
      {attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const ingestion =
              ingestionsByAttachmentId.get(attachment.id) ?? null;
            const ingestionView =
              getIngestionView(ingestion) ??
              getMissingIngestionView({ purpose: attachment.purpose });
            const canReingest =
              (attachment.purpose === "invoice" ||
                attachment.purpose === "contract") &&
              ingestion?.status !== "processing";

            return (
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
                    {attachment.description && (
                      <div className="truncate text-sm text-muted-foreground">
                        {attachment.description}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {
                          ATTACHMENT_PURPOSE_LABELS[
                            attachment.purpose ?? "other"
                          ]
                        }
                      </Badge>
                      <Badge variant="outline">
                        {
                          ATTACHMENT_VISIBILITY_LABELS[
                            attachment.visibility ?? "internal"
                          ]
                        }
                      </Badge>
                      {ingestionView ? (
                        <Badge className="gap-1.5" variant="outline">
                          {isActiveIngestionStatus(ingestionView.status) ? (
                            <Spinner className="size-3" />
                          ) : null}
                          {
                            ATTACHMENT_INGESTION_STATUS_LABELS[
                              ingestionView.status
                            ]
                          }
                        </Badge>
                      ) : null}
                    </div>
                    {ingestionView?.description ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {ingestionView.description}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)} ·{" "}
                      {formatDate(attachment.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    className="h-8 w-8 p-0"
                    onClick={() => onDownload(attachment.id)}
                    size="sm"
                    title="Скачать"
                    variant="ghost"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canReingest ? (
                    <Button
                      className="h-8 w-8 p-0"
                      disabled={reingestingAttachmentId === attachment.id}
                      onClick={() => onReingest(attachment.id)}
                      size="sm"
                      title="Запустить распознавание повторно"
                      variant="ghost"
                    >
                      {reingestingAttachmentId === attachment.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                  <Button
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={deletingAttachmentId === attachment.id}
                    onClick={() => onDelete(attachment.id)}
                    size="sm"
                    title="Удалить"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function AttachmentListSection({
  attachments,
  attachmentIngestions,
  deletingAttachmentId,
  emptyText = "Загрузите инвойс, договор или другой файл, связанный с основанием сделки.",
  reingestingAttachmentId,
  title = "Файлы основания",
  onUpload,
  onDownload,
  onDelete,
  onReingest,
}: AttachmentsCardProps) {
  return (
    <section className="space-y-3 border-t pt-6">
      <AttachmentListHeader onUpload={onUpload} title={title} />
      <AttachmentListContent
        attachmentIngestions={attachmentIngestions}
        attachments={attachments}
        deletingAttachmentId={deletingAttachmentId}
        emptyText={emptyText}
        onDelete={onDelete}
        onDownload={onDownload}
        onReingest={onReingest}
        reingestingAttachmentId={reingestingAttachmentId}
      />
    </section>
  );
}
