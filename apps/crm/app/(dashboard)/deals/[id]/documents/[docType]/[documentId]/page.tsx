"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { DocumentActionButtons } from "@bedrock/sdk-documents-form-ui/components/document-action-buttons";
import { DocumentWorkbenchCard } from "@bedrock/sdk-documents-form-ui/components/document-workbench-card";
import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";

import { DEAL_TYPE_LABELS } from "@/app/(dashboard)/deals/[id]/_components/constants";
import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";
import { formatDealBreadcrumbLabel } from "@/components/app/breadcrumbs";
import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import { getCrmDocumentTypeLabel, isCrmDocType } from "@/features/documents/lib/doc-types";
import { fetchCrmDocumentFormOptions } from "@/features/documents/lib/form-options";
import {
  createDealScopedDocumentDraft,
  updateDocumentDraft,
} from "@/features/documents/lib/mutations";
import { buildCrmDocumentMutators } from "@/features/documents/lib/permissions";
import {
  fetchCrmDocumentById,
  type CrmDocumentDetail,
} from "@/features/documents/lib/queries";
import {
  buildCrmDealDocumentDetailsHref,
  buildCrmDealDocumentsTabHref,
} from "@/features/documents/lib/routes";
import { API_BASE_URL } from "@/lib/constants";

const SUBMISSION_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлен",
};

const APPROVAL_LABELS: Record<string, string> = {
  not_required: "Не требуется",
  pending: "Ожидает согласования",
  approved: "Согласован",
  rejected: "Отклонен",
};

const POSTING_LABELS: Record<string, string> = {
  unposted: "Не проведен",
  posted: "Проведен",
  not_required: "Не требуется",
  ready: "Готов",
  skipped: "Пропущен",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  active: "Активен",
  cancelled: "Отменен",
};

function getStatusBadgeVariant(
  status: string,
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning" {
  if (status === "approved" || status === "posted" || status === "active") {
    return "success";
  }
  if (status === "submitted") return "default";
  if (status === "draft" || status === "not_required" || status === "unposted")
    return "secondary";
  if (status === "rejected" || status === "cancelled") return "destructive";
  if (status === "pending") return "warning";
  return "outline";
}

export default function DealDocumentDetailPage() {
  const params = useParams<{ id: string; docType: string; documentId: string }>();
  const router = useRouter();
  const dealId = params?.id ?? "";
  const docType = params?.docType ?? "";
  const documentId = params?.documentId ?? "";

  const [document, setDocument] = useState<CrmDocumentDetail | null>(null);
  const [workbench, setWorkbench] =
    useState<ApiCrmDealWorkbenchProjection | null>(null);
  const [formOptions, setFormOptions] = useState<DocumentFormOptions | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useCrmBreadcrumbs(
    docType && documentId && dealId
      ? [
          ...(workbench
            ? [
                {
                  href: `/deals/${dealId}`,
                  label: formatDealBreadcrumbLabel({
                    applicantDisplayName:
                      workbench.summary.applicantDisplayName,
                    dealTypeLabel:
                      DEAL_TYPE_LABELS[workbench.summary.type] ?? "Сделка",
                  }),
                },
              ]
            : []),
          {
            href: buildCrmDealDocumentDetailsHref(dealId, docType, documentId),
            label: document?.docNo
              ? `${getCrmDocumentTypeLabel(docType)} № ${document.docNo}`
              : getCrmDocumentTypeLabel(docType),
          },
        ]
      : [],
  );

  if (!docType || !isCrmDocType(docType)) {
    notFound();
  }

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [result, options, workbenchPayload] = await Promise.all([
      fetchCrmDocumentById({ docType, documentId }),
      fetchCrmDocumentFormOptions(),
      fetch(`${API_BASE_URL}/deals/${dealId}/crm-workbench`, {
        cache: "no-store",
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    if (!result) {
      setError("Документ не найден");
    } else {
      setDocument(result);
    }
    setFormOptions(options);
    if (workbenchPayload) {
      const data = workbenchPayload as {
        workbench: ApiCrmDealWorkbenchProjection;
      };
      setWorkbench(data.workbench);
    }
    setLoading(false);
  }, [dealId, docType, documentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const documentMutators = useMemo(() => buildCrmDocumentMutators(), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-4 py-8">
        <p className="text-sm text-destructive">{error ?? "Документ не найден"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>
                {getCrmDocumentTypeLabel(document.docType)} № {document.docNo}
              </CardTitle>
              <CardDescription>{document.title ?? null}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusBadgeVariant(document.submissionStatus)}>
                  Отправка:{" "}
                  {SUBMISSION_LABELS[document.submissionStatus] ??
                    document.submissionStatus}
                </Badge>
                <Badge variant={getStatusBadgeVariant(document.approvalStatus)}>
                  Согласование:{" "}
                  {APPROVAL_LABELS[document.approvalStatus] ??
                    document.approvalStatus}
                </Badge>
                <Badge variant={getStatusBadgeVariant(document.postingStatus)}>
                  Проведение:{" "}
                  {POSTING_LABELS[document.postingStatus] ??
                    document.postingStatus}
                </Badge>
                <Badge variant={getStatusBadgeVariant(document.lifecycleStatus)}>
                  Состояние:{" "}
                  {LIFECYCLE_LABELS[document.lifecycleStatus] ??
                    document.lifecycleStatus}
                </Badge>
              </div>
            </div>
            <DocumentActionButtons
              docType={document.docType}
              documentId={document.id}
              allowedActions={document.allowedActions}
              mutators={documentMutators}
              onPostedSuccess={async () => {
                router.push(buildCrmDealDocumentsTabHref(dealId));
              }}
            />
          </div>
        </CardHeader>
      </Card>

      {formOptions ? (
        <DocumentWorkbenchCard
          docType={document.docType}
          docTypeLabel={getCrmDocumentTypeLabel(document.docType)}
          documentId={document.id}
          payload={document.payload ?? {}}
          allowedActions={document.allowedActions}
          isAdmin={false}
          options={formOptions}
          createMutator={async ({ docType: type, dealId: targetDealId, payload }) => {
            if (!targetDealId) {
              return {
                ok: false,
                message: "Не указан идентификатор сделки",
              };
            }
            return createDealScopedDocumentDraft({
              dealId: targetDealId,
              docType: type,
              payload,
            });
          }}
          updateMutator={async ({ docType: type, documentId: id, payload }) =>
            updateDocumentDraft({ docType: type, documentId: id, payload })
          }
        />
      ) : null}
    </div>
  );
}
