"use client";

import { useMemo } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { formatFileSize } from "./file-utils";

type DealAttachment = FinanceDealWorkbench["relatedResources"]["attachments"][number];

export interface DealAttachmentsCardProps {
  canUpload: boolean;
  deal: FinanceDealWorkbench;
  deletingAttachmentId: string | null;
  onDeleteAttachment: (attachmentId: string) => void;
  onDownloadAttachment: (attachmentId: string) => void;
  onOpenUpload: () => void;
}

export function DealAttachmentsCard({
  canUpload,
  deal,
  deletingAttachmentId,
  onDeleteAttachment,
  onDownloadAttachment,
  onOpenUpload,
}: DealAttachmentsCardProps) {
  const rows = useMemo(
    () =>
      [...deal.relatedResources.attachments].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    [deal.relatedResources.attachments],
  );

  return (
    <section
      className="bg-card rounded-lg border"
      data-testid="finance-deal-attachments-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <Paperclip className="text-muted-foreground h-4 w-4" />
          <div className="text-sm font-semibold">Вложения</div>
          <Badge variant="outline" className="font-mono">
            {rows.length}
          </Badge>
        </div>
        <Button
          data-testid="finance-deal-attachments-upload"
          size="sm"
          variant="outline"
          disabled={!canUpload}
          onClick={onOpenUpload}
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          Загрузить файл
        </Button>
      </header>

      <div className="flex flex-col divide-y">
        {rows.length === 0 ? (
          <div className="text-muted-foreground px-4 py-6 text-center text-sm">
            Вложений пока нет.
          </div>
        ) : (
          rows.map((row) => (
            <AttachmentRow
              key={row.id}
              deletingAttachmentId={deletingAttachmentId}
              onDelete={onDeleteAttachment}
              onDownload={onDownloadAttachment}
              row={row}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AttachmentRow({
  deletingAttachmentId,
  onDelete,
  onDownload,
  row,
}: {
  deletingAttachmentId: string | null;
  onDelete: (attachmentId: string) => void;
  onDownload: (attachmentId: string) => void;
  row: DealAttachment;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3"
      data-testid={`finance-deal-attachment-row-deal-${row.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{row.fileName}</span>
          <Badge variant="secondary" className="shrink-0 font-normal">
            Сделка
          </Badge>
        </div>
        {row.description ? (
          <div className="text-muted-foreground mt-0.5 truncate text-xs">
            {row.description}
          </div>
        ) : null}
        <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
          {formatFileSize(row.fileSize)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          title="Скачать"
          onClick={() => onDownload(row.id)}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="Удалить"
          disabled={deletingAttachmentId === row.id}
          onClick={() => onDelete(row.id)}
        >
          <Trash2 className="h-4 w-4 text-rose-600" />
        </Button>
      </div>
    </div>
  );
}
