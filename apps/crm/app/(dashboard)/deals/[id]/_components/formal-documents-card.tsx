"use client";

import Link from "next/link";
import { useState } from "react";

import { AlertTriangle, Download, ExternalLink, File, Plus } from "lucide-react";

import { PrintFormActions } from "@bedrock/sdk-print-forms-ui/components/print-form-actions";
import {
  downloadPrintForm,
  type PrintFormOwner,
} from "@bedrock/sdk-print-forms-ui/lib/client";
import type {
  PrintFormDescriptor,
  PrintFormFormat,
} from "@bedrock/sdk-print-forms-ui/lib/schemas";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import { canCreateCrmDocumentType } from "@/features/documents/lib/doc-types";
import {
  buildCrmDealDocumentCreateHref,
  buildCrmDealDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import { API_BASE_URL } from "@/lib/constants";

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
    invoicePurpose?: "combined" | "principal" | "agency_fee" | null;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }>;
};

const INVOICE_PURPOSE_LABELS: Record<
  "combined" | "principal" | "agency_fee",
  string
> = {
  agency_fee: "Счет на агентское вознаграждение",
  combined: "Счёт на оплату",
  principal: "Счёт на оплату",
};

function getRequirementLabel(
  requirement: NonNullable<FormalDocumentsCardProps["requirements"]>[number],
) {
  if (requirement.docType === "invoice" && requirement.invoicePurpose) {
    return INVOICE_PURPOSE_LABELS[requirement.invoicePurpose];
  }

  return FORMAL_DOCUMENT_LABELS[requirement.docType] || requirement.docType;
}

const REQUIREMENT_STATE_LABELS: Record<
  NonNullable<FormalDocumentsCardProps["requirements"]>[number]["state"],
  string
> = {
  in_progress: "В работе",
  missing: "Отсутствует",
  not_required: "Не требуется",
  ready: "Готов",
};

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

function RequirementPrintFormExports({
  forms,
  owner,
}: {
  forms: PrintFormDescriptor[];
  owner: PrintFormOwner;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (forms.length === 0) {
    return null;
  }

  async function runDownload(form: PrintFormDescriptor, format: PrintFormFormat) {
    const key = `${form.id}:${format}`;
    setActiveKey(key);

    try {
      await downloadPrintForm({
        client: { baseUrl: API_BASE_URL, credentials: "include" },
        form,
        format,
        owner,
      });
      toast.success("Печатная форма выгружена");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось выгрузить печатную форму",
      );
    } finally {
      setActiveKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {forms.map((form) => (
        <div
          key={form.id}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {form.quality === "draft" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            ) : null}
            <span className="truncate">{form.title}</span>
          </div>
          {form.formats.map((format) => {
            const key = `${form.id}:${format}`;
            const isActive = activeKey === key;

            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                disabled={activeKey !== null}
                onClick={() => void runDownload(form, format)}
              >
                {isActive ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {format.toUpperCase()}
              </Button>
            );
          })}
        </div>
      ))}
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
            {requirements.map((requirement) => {
              const activeDocument = requirement.activeDocumentId
                ? documents.find(
                    (document) => document.id === requirement.activeDocumentId,
                  )
                : null;

              return (
                <div
                  key={`${requirement.stage}:${requirement.docType}:${requirement.invoicePurpose ?? "default"}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {getRequirementLabel(requirement)}
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
                                {
                                  invoicePurpose: requirement.invoicePurpose,
                                },
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
                          {activeDocument ? (
                            <RequirementPrintFormExports
                              forms={activeDocument.printForms}
                              owner={{
                                type: "document",
                                docType: activeDocument.docType,
                                documentId: activeDocument.id,
                              }}
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
              );
            })}
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <PrintFormActions
                      client={{ baseUrl: API_BASE_URL, credentials: "include" }}
                      forms={document.printForms}
                      owner={{
                        type: "document",
                        docType: document.docType,
                        documentId: document.id,
                      }}
                      size="sm"
                    />
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
