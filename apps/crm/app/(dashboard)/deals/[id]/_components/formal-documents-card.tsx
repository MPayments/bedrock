import { File } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

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

export function FormalDocumentsCard({
  documents,
  requirements = [],
}: FormalDocumentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5 text-muted-foreground" />
          Внутренние документы
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requirements.length > 0 ? (
          <div className="space-y-3">
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
                  <Badge variant="outline">
                    {REQUIREMENT_STATE_LABELS[requirement.state]}
                  </Badge>
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
        {documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет формальных документов.
          </div>
        ) : (
          <div className="space-y-3">
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
