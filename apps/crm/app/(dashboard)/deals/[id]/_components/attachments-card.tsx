import { Download, File, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

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
  reingestingAttachmentId: string | null;
  onUpload: () => void;
  onDownload: (attachmentId: string) => void;
  onDelete: (attachmentId: string) => void;
  onReingest: (attachmentId: string) => void;
};

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

function getIngestionView(
  ingestion: ApiDealAttachmentIngestion | null,
): {
  description: string | null;
  status:
    | "applied"
    | "failed"
    | "pending"
    | "processed_without_changes"
    | "processing"
    | "unavailable";
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

function getMissingIngestionView(input: {
  purpose: ApiAttachment["purpose"];
}) {
  if (input.purpose !== "invoice" && input.purpose !== "contract") {
    return null;
  }

  return {
    description: "Файл еще не был отправлен на распознавание.",
    status: "pending" as const,
  };
}

export function AttachmentsCard({
  attachments,
  attachmentIngestions,
  deletingAttachmentId,
  reingestingAttachmentId,
  onUpload,
  onDownload,
  onDelete,
  onReingest,
}: AttachmentsCardProps) {
  const ingestionsByAttachmentId = new Map(
    attachmentIngestions.map((ingestion) => [ingestion.fileAssetId, ingestion]),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            Подтверждающие файлы
          </CardTitle>
          <Button onClick={onUpload} size="sm" variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Загрузить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке пока нет загруженных вложений.
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const ingestion = ingestionsByAttachmentId.get(attachment.id) ?? null;
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
                        {ATTACHMENT_PURPOSE_LABELS[attachment.purpose ?? "other"]}
                      </Badge>
                      <Badge variant="outline">
                        {
                          ATTACHMENT_VISIBILITY_LABELS[
                            attachment.visibility ?? "internal"
                          ]
                        }
                      </Badge>
                      {ingestionView ? (
                        <Badge variant="outline">
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
                      <RotateCcw className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );
}
