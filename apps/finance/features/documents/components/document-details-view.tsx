import Link from "next/link";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Separator } from "@bedrock/sdk-ui/components/separator";

import type { UserRole } from "@/lib/auth/types";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { OperationDetailsCards } from "@/features/operations/journal/components/operation-details-cards";
import {
  getApprovalStatusLabel,
  getLifecycleStatusLabel,
  getPostingStatusLabel,
  getSubmissionStatusLabel,
} from "@/features/documents/lib/status-labels";
import { formatAmountByCurrency, formatDate } from "@/lib/format";
import {
  type DocumentDetailsDto,
  type DocumentDto,
} from "@/features/operations/documents/lib/schemas";
import { DealWorkflowDialog } from "@/features/treasury/quotes/components/deal-workflow-dialog";

import { DocumentActionButtons } from "./document-action-buttons";
import { DocumentWorkbenchCard } from "./document-workbench-card";

function StatusBadges({
  submissionStatus,
  approvalStatus,
  postingStatus,
  lifecycleStatus,
}: {
  submissionStatus: string;
  approvalStatus: string;
  postingStatus: string;
  lifecycleStatus: string;
}) {
  function getStatusBadgeVariant(
    status: string,
    kind: "submission" | "approval" | "posting" | "lifecycle",
  ): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
    if (
      status === "approved" ||
      status === "posted" ||
      status === "active"
    ) {
      return "success";
    }

    if (kind === "approval" && status === "pending") {
      return "warning";
    }

    if (
      status === "submitted" ||
      status === "posting"
    ) {
      return "default";
    }

    if (
      status === "draft" ||
      status === "not_required" ||
      status === "unposted"
    ) {
      return "secondary";
    }

    if (
      status === "rejected" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      return "destructive";
    }

    return "outline";
  }

  const items = [
    {
      label: "Статус",
      value: getSubmissionStatusLabel(submissionStatus),
      variant: getStatusBadgeVariant(submissionStatus, "submission"),
    },
    {
      label: "Согласование",
      value: getApprovalStatusLabel(approvalStatus),
      variant: getStatusBadgeVariant(approvalStatus, "approval"),
    },
    {
      label: "Учет",
      value: getPostingStatusLabel(postingStatus),
      variant: getStatusBadgeVariant(postingStatus, "posting"),
    },
    {
      label: "Жизненный цикл",
      value: getLifecycleStatusLabel(lifecycleStatus),
      variant: getStatusBadgeVariant(lifecycleStatus, "lifecycle"),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.label} variant={item.variant}>
          {item.label}: {item.value}
        </Badge>
      ))}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildDocumentHref(
  basePath: string,
  document: Pick<DocumentDto, "docType" | "id">,
) {
  return `${basePath}/${document.docType}/${document.id}`;
}

export function DocumentDetailsView({
  dealId,
  details,
  documentBasePath,
  userRole,
  formOptions,
}: {
  dealId?: string | null;
  details: DocumentDetailsDto;
  documentBasePath: string;
  userRole: UserRole;
  formOptions: DocumentFormOptions;
}) {
  const document = details.document;
  const computed = isRecord(details.computed) ? details.computed : null;
  const timeline = Array.isArray(computed?.timeline) ? computed.timeline : null;
  const separateFeeComponents = Array.isArray(computed?.separateFeeComponents)
    ? computed.separateFeeComponents
    : null;
  const journalOperationsById = new Map(
    details.ledgerOperations
      .filter((operation) => Boolean(operation))
      .map((operation) => [operation!.operation.id, operation!] as const),
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{document.docNo}</CardTitle>
              <CardDescription>{document.title}</CardDescription>
              <StatusBadges
                submissionStatus={document.submissionStatus}
                approvalStatus={document.approvalStatus}
                postingStatus={document.postingStatus}
                lifecycleStatus={document.lifecycleStatus}
              />
            </div>
            <DocumentActionButtons
              docType={document.docType}
              documentId={document.id}
              allowedActions={document.allowedActions}
            />
            {dealId ? <DealWorkflowDialog dealId={dealId} /> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Тип:</span>{" "}
              {getDocumentTypeLabel(document.docType)}
            </div>
            <div>
              <span className="text-muted-foreground">Дата:</span>{" "}
              {formatDate(document.occurredAt)}
            </div>
            <div>
              <span className="text-muted-foreground">Создан:</span>{" "}
              {formatDate(document.createdAt)}
            </div>
            {document.postingOperationId ? (
              <div>
                <span className="text-muted-foreground">Журнал:</span>{" "}
                <Link
                  href={`/documents/journal/${document.postingOperationId}`}
                  className="font-mono hover:underline"
                >
                  {document.postingOperationId}
                </Link>
              </div>
            ) : null}
          </div>
          <div className="space-y-2 text-sm">
            {document.currency ? (
              <div>
                <span className="text-muted-foreground">Валюта:</span>{" "}
                {document.currency}
              </div>
            ) : null}
            {document.amount ? (
              <div>
                <span className="text-muted-foreground">Сумма:</span>{" "}
                {formatAmountByCurrency(document.amount, document.currency)}{" "}
                {document.currency ?? ""}
              </div>
            ) : null}
            {document.memo ? (
              <div>
                <span className="text-muted-foreground">Комментарий:</span>{" "}
                {document.memo}
              </div>
            ) : null}
            {document.postingError ? (
              <div className="text-destructive">
                <span className="text-muted-foreground">
                  Ошибка проведения:
                </span>{" "}
                {document.postingError}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <DocumentWorkbenchCard
        docType={document.docType}
        documentId={document.id}
        payload={document.payload}
        allowedActions={document.allowedActions}
        userRole={userRole}
        options={formOptions}
      />

      {timeline ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Связанные этапы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            {timeline.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Этапы еще не созданы.
              </div>
            ) : (
              timeline.map((item) => {
                if (!isRecord(item)) {
                  return null;
                }

                const itemId = typeof item.id === "string" ? item.id : "";
                const itemDocType =
                  typeof item.docType === "string" ? item.docType : "document";
                const itemDocNo =
                  typeof item.docNo === "string" ? item.docNo : itemId;
                const itemPostingStatus =
                  typeof item.postingStatus === "string"
                    ? item.postingStatus
                    : "unknown";

                return (
                  <div
                    key={itemId}
                    className="flex flex-col gap-2 rounded-sm border p-3 text-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`${documentBasePath}/${itemDocType}/${itemId}`}
                        className="font-medium hover:underline"
                      >
                        {itemDocNo}
                      </Link>
                      <div className="text-muted-foreground">
                        {getDocumentTypeLabel(itemDocType)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {getPostingStatusLabel(itemPostingStatus)}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {separateFeeComponents ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Отдельные fee-компоненты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            {separateFeeComponents.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Отдельных fee payout компонентов нет.
              </div>
            ) : (
              separateFeeComponents.map((item, index) => {
                if (!isRecord(item)) {
                  return null;
                }

                return (
                  <div
                    key={`${String(item.componentId ?? index)}`}
                    className="rounded-sm border p-3 text-sm"
                  >
                    <div className="font-medium">
                      {String(item.componentId ?? "компонент")}
                    </div>
                    <div className="text-muted-foreground">
                      {String(item.kind ?? "")} / {String(item.currency ?? "")}{" "}
                      / {String(item.amount ?? "")}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {details.computed ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Вычисленные данные</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <pre className="bg-muted overflow-x-auto rounded-sm p-4 text-xs">
              {JSON.stringify(details.computed, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Связанные документы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-6 text-sm">
          {details.parent ? (
            <div>
              <div className="text-muted-foreground mb-2">
                Родительский документ
              </div>
              <Link
                href={buildDocumentHref(documentBasePath, details.parent)}
                className="hover:underline"
              >
                {details.parent.docNo}
              </Link>
            </div>
          ) : null}
          {details.dependsOn.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">Зависит от</div>
              <div className="flex flex-col gap-2">
                {details.dependsOn.map((item) => (
                  <Link
                    key={item.id}
                    href={buildDocumentHref(documentBasePath, item)}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {details.children.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">
                Дочерние документы
              </div>
              <div className="flex flex-col gap-2">
                {details.children.map((item) => (
                  <Link
                    key={item.id}
                    href={buildDocumentHref(documentBasePath, item)}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {details.compensates.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">Компенсирует</div>
              <div className="flex flex-col gap-2">
                {details.compensates.map((item) => (
                  <Link
                    key={item.id}
                    href={buildDocumentHref(documentBasePath, item)}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Операции в журнале</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          {details.documentOperations.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Нет связанных операций.
            </div>
          ) : (
            details.documentOperations.map((operation, index) => (
              <div key={operation.id} className="space-y-4">
                {index > 0 ? <Separator /> : null}
                {journalOperationsById.get(operation.operationId) ? (
                  <OperationDetailsCards
                    details={journalOperationsById.get(operation.operationId)!}
                    showTbPlan={false}
                    title={
                      <Link
                        href={`/documents/journal/${operation.operationId}`}
                        className="font-mono hover:underline"
                      >
                        Операция {operation.operationId}
                      </Link>
                    }
                    description={
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Связанная операция документа.</span>
                        <Badge variant="outline" className="font-normal">
                          {operation.kind}
                        </Badge>
                      </div>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <Link
                        href={`/documents/journal/${operation.operationId}`}
                        className="font-mono hover:underline"
                      >
                        {operation.operationId}
                      </Link>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Не удалось загрузить детали операции.
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
