import { Download, File, Trash2, Upload } from "lucide-react";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { formatDate } from "./format";
import { formatFileSize, getFileIcon } from "./file-utils";
import type { ApiAttachment } from "./types";

type AttachmentsCardProps = {
  attachments: ApiAttachment[];
  deletingAttachmentId: string | null;
  onUpload: () => void;
  onDownload: (attachmentId: string) => void;
  onDelete: (attachmentId: string) => void;
};

export function AttachmentsCard({
  attachments,
  deletingAttachmentId,
  onUpload,
  onDownload,
  onDelete,
}: AttachmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            Вложения
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
            {attachments.map((attachment) => (
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
