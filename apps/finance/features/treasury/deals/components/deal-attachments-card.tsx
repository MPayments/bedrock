"use client";

import { useMemo } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import { getDealLegKindLabel } from "@/features/treasury/deals/labels";
import type {
  FinanceDealInstructionArtifact,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";

import { formatFileSize } from "./file-utils";

type DealAttachment = FinanceDealWorkbench["relatedResources"]["attachments"][number];

interface MergedRow {
  description: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  kind: "deal" | "instruction";
  legIdx: number | null;
  legKind: string | null;
  mimeType: string;
  purpose: string | null;
  source: DealAttachment | FinanceDealInstructionArtifact;
  uploadedAt: string;
  uploadedBy: string | null;
}

const INSTRUCTION_ARTIFACT_PURPOSE_LABEL: Record<string, string> = {
  submission_confirmation: "Подтверждение отправки",
  bank_confirmation: "Подтверждение банка",
  counterparty_receipt: "Квитанция контрагента",
  settlement_confirmation: "Подтверждение расчёта",
  exception_note: "Примечание по исключению",
};

function mergeRows(deal: FinanceDealWorkbench): MergedRow[] {
  const dealRows: MergedRow[] = deal.relatedResources.attachments.map(
    (attachment) => ({
      description: attachment.description,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      id: attachment.id,
      kind: "deal",
      legIdx: null,
      legKind: null,
      mimeType: attachment.mimeType,
      purpose: attachment.visibility,
      source: attachment,
      uploadedAt: attachment.createdAt,
      uploadedBy: attachment.uploadedBy,
    }),
  );

  const artifactRows: MergedRow[] =
    deal.relatedResources.instructionArtifacts.map((artifact) => ({
      description: artifact.memo,
      fileName: artifact.fileName,
      fileSize: artifact.fileSize,
      id: artifact.id,
      kind: "instruction",
      legIdx: artifact.legIdx,
      legKind: artifact.legKind,
      mimeType: artifact.mimeType,
      purpose: artifact.purpose,
      source: artifact,
      uploadedAt: artifact.uploadedAt,
      uploadedBy: artifact.uploadedByUserId,
    }));

  return [...dealRows, ...artifactRows].sort((left, right) =>
    right.uploadedAt.localeCompare(left.uploadedAt),
  );
}

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
  const rows = useMemo(() => mergeRows(deal), [deal]);

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
              key={`${row.kind}:${row.id}`}
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
  row: MergedRow;
}) {
  const sourceLabel =
    row.kind === "deal"
      ? "Сделка"
      : row.legIdx !== null
        ? `Шаг ${row.legIdx} · ${row.legKind ? getDealLegKindLabel(row.legKind) : ""}`
        : "Инструкция";
  const purposeLabel =
    row.kind === "instruction" && row.purpose
      ? INSTRUCTION_ARTIFACT_PURPOSE_LABEL[row.purpose] ?? row.purpose
      : null;

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3"
      data-testid={`finance-deal-attachment-row-${row.kind}-${row.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{row.fileName}</span>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {sourceLabel}
          </Badge>
          {purposeLabel ? (
            <Badge variant="outline" className="shrink-0 font-normal">
              {purposeLabel}
            </Badge>
          ) : null}
        </div>
        {row.description ? (
          <div className="text-muted-foreground mt-0.5 truncate text-xs">
            {row.description}
          </div>
        ) : null}
        <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
          {formatFileSize(row.fileSize)} · {row.mimeType}
          {row.uploadedBy ? ` · ${row.uploadedBy}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {row.kind === "deal" ? (
          <Button
            size="icon"
            variant="ghost"
            title="Скачать"
            onClick={() => onDownload(row.id)}
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : null}
        {row.kind === "deal" ? (
          <Button
            size="icon"
            variant="ghost"
            title="Удалить"
            disabled={deletingAttachmentId === row.id}
            onClick={() => onDelete(row.id)}
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
