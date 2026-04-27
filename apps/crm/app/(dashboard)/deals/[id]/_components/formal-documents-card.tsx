"use client";

import { useState } from "react";
import Link from "next/link";

import { Download, ExternalLink, File, Loader2, Plus } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { canCreateCrmDocumentType } from "@/features/documents/lib/doc-types";
import { downloadDocumentPrintForm } from "@/features/documents/lib/mutations";
import {
  buildCrmDealDocumentCreateHref,
  buildCrmDealDocumentDetailsHref,
} from "@/features/documents/lib/routes";

import {
  DOCUMENT_APPROVAL_STATUS_LABELS,
  DOCUMENT_POSTING_STATUS_LABELS,
  DOCUMENT_SUBMISSION_STATUS_LABELS,
  formatDealWorkflowMessage,
  FORMAL_DOCUMENT_LABELS,
} from "./constants";
import { formatCurrency, formatDate } from "./format";
import type { ApiFormalDocument } from "./types";

type FormalDocumentsCardProps = {
  dealId: string;
  documents: ApiFormalDocument[];
  requirements?: Array<{
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }>;
};

const REQUIREMENT_STATE_LABELS: Record<
  NonNullable<FormalDocumentsCardProps["requirements"]>[number]["state"],
  string
> = {
  in_progress: "В работе",
  missing: "Отсутствует",
  not_required: "Не требуется",
  ready: "Готов",
};

const PRINTABLE_DOC_TYPES = new Set(["acceptance", "application", "invoice"]);

function renderDocumentStatusLabel(
  kind: "submission" | "approval" | "posting",
  value: string,
) {
  if (kind === "submission") {
    return DOCUMENT_SUBMISSION_STATUS_LABELS[value] ?? value;
  }

  if (kind === "approval") {
    return DOCUMENT_APPROVAL_STATUS_LABELS[value] ?? value;
  }

  return DOCUMENT_POSTING_STATUS_LABELS[value] ?? value;
}

function QuickPrintExportControl({
  docType,
  documentId,
}: {
  docType: string;
  documentId: string;
}) {
  const [format, setFormat] = useState<"docx" | "pdf">("pdf");
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    const result = await downloadDocumentPrintForm({
      docType,
      documentId,
      format,
    });
    setIsDownloading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Печатная форма выгружена");
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={format}
        onValueChange={(value) => setFormat(value as "docx" | "pdf")}
      >
        <SelectTrigger className="h-8 w-[92px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="docx">DOCX</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isDownloading}
        onClick={() => void handleDownload()}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Выгрузить
      </Button>
    </div>
  );
}

export function FormalDocumentsCard({
  dealId,
  documents,
  requirements = [],
}: FormalDocumentsCardProps) {
  const hasRequirements = requirements.length > 0;
  const hasDocuments = documents.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5 text-muted-foreground" />
          Внутренние документы
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasRequirements ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              Требуемые документы
            </div>
            {requirements.map((requirement) => (
              <div key={`${requirement.stage}:${requirement.docType}`} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {FORMAL_DOCUMENT_LABELS[requirement.docType] ||
                        requirement.docType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {requirement.stage === "opening"
                        ? "Открывающий документ"
                        : "Закрывающий документ"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {requirement.state === "missing" &&
                    requirement.createAllowed &&
                    canCreateCrmDocumentType(requirement.docType) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={
                          <Link
                            href={buildCrmDealDocumentCreateHref(
                              dealId,
                              requirement.docType,
                            )}
                          >
                            <Plus className="h-4 w-4" /> Создать
                          </Link>
                        }
                      />
                    ) : null}
                    {requirement.activeDocumentId &&
                    requirement.openAllowed ? (
                      <>
                        {PRINTABLE_DOC_TYPES.has(requirement.docType) ? (
                          <QuickPrintExportControl
                            docType={requirement.docType}
                            documentId={requirement.activeDocumentId}
                          />
                        ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <Link
                            href={buildCrmDealDocumentDetailsHref(
                              dealId,
                              requirement.docType,
                              requirement.activeDocumentId,
                            )}
                          >
                            <ExternalLink className="h-4 w-4" /> Открыть
                          </Link>
                        }
                      />
                      </>
                    ) : null}
                    <Badge variant="outline">
                      {REQUIREMENT_STATE_LABELS[requirement.state]}
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
            ))}
          </div>
        ) : null}
        {!hasDocuments ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет формальных документов.
          </div>
        ) : (
          <div className="space-y-3">
            {hasRequirements ? (
              <div className="text-sm font-medium text-muted-foreground">
                Созданные документы
              </div>
            ) : null}
            {documents.map((document) => (
              <div
                key={document.id}
                className="rounded-lg border p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium">
                      {document.title ||
                        FORMAL_DOCUMENT_LABELS[document.docType] ||
                        document.docType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(document.createdAt)}
                    </div>
                    {document.amount && (
                      <div className="text-sm">
                        {formatCurrency(document.amount, document.currency)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Отправка:{" "}
                      {renderDocumentStatusLabel(
                        "submission",
                        document.submissionStatus,
                      )}
                    </Badge>
                    <Badge variant="outline">
                      Согласование:{" "}
                      {renderDocumentStatusLabel(
                        "approval",
                        document.approvalStatus,
                      )}
                    </Badge>
                    <Badge variant="outline">
                      Проведение:{" "}
                      {renderDocumentStatusLabel(
                        "posting",
                        document.postingStatus,
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
