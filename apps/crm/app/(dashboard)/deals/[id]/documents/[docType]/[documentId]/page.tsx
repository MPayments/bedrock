"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { DocumentActionButtons } from "@bedrock/sdk-documents-form-ui/components/document-action-buttons";
import { DocumentWorkbenchCard } from "@bedrock/sdk-documents-form-ui/components/document-workbench-card";
import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";
import type {
  DocumentMutationResult,
  DocumentTransitionMutator,
  DocumentTransitionMutators,
} from "@bedrock/sdk-documents-form-ui/lib/mutations";
import { PrintFormActions } from "@bedrock/sdk-print-forms-ui/components/print-form-actions";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { DEAL_TYPE_LABELS } from "@/app/(dashboard)/deals/[id]/_components/constants";
import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";
import { formatDealBreadcrumbLabel } from "@/components/app/breadcrumbs";
import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import {
  canCreateCrmDocumentType,
  getCrmDocumentTypeLabel,
  isCrmDocType,
} from "@/features/documents/lib/doc-types";
import { CRM_DOCUMENT_FORM_DEFINITIONS } from "@/features/documents/lib/form-definitions";
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
  buildCrmDealDocumentCreateHref,
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

function applyDocumentMutationResult(
  current: CrmDocumentDetail | null,
  result: DocumentMutationResult,
): CrmDocumentDetail | null {
  if (!current || !result.ok || result.data.id !== current.id) {
    return current;
  }

  return {
    ...current,
    allowedActions: result.data.allowedActions ?? current.allowedActions,
    approvalStatus: result.data.approvalStatus ?? current.approvalStatus,
    lifecycleStatus: result.data.lifecycleStatus ?? current.lifecycleStatus,
    postingStatus: result.data.postingStatus ?? current.postingStatus,
    submissionStatus: result.data.submissionStatus ?? current.submissionStatus,
  };
}

export default function DealDocumentDetailPage() {
  const params = useParams<{ id: string; docType: string; documentId: string }>();
  const router = useRouter();
  const dealId = params?.id ?? "";
  const docType = params?.docType ?? "";
  const documentId = params?.documentId ?? "";
  const isLegacyCreateRoute =
    docType === "create" && canCreateCrmDocumentType(documentId);

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

  if (!isLegacyCreateRoute && (!docType || !isCrmDocType(docType))) {
    notFound();
  }

  const reload = useCallback(async () => {
    if (isLegacyCreateRoute) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    const [result, options, workbenchPayload] = await Promise.all([
      fetchCrmDocumentById({ docType, documentId }),
      fetchCrmDocumentFormOptions({ dealId }),
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
      setWorkbench(workbenchPayload as ApiCrmDealWorkbenchProjection);
    }
    setLoading(false);
  }, [dealId, docType, documentId, isLegacyCreateRoute]);

  useEffect(() => {
    if (isLegacyCreateRoute) {
      router.replace(buildCrmDealDocumentCreateHref(dealId, documentId));
      return;
    }

    void reload();
  }, [dealId, documentId, isLegacyCreateRoute, reload, router]);

  const documentMutators = useMemo<DocumentTransitionMutators>(() => {
    const baseMutators = buildCrmDocumentMutators();
    const wrapMutator = (
      mutator: DocumentTransitionMutator | undefined,
    ): DocumentTransitionMutator | undefined => {
      if (!mutator) return undefined;
      return async (input) => {
        const result = await mutator(input);
        setDocument((current) => applyDocumentMutationResult(current, result));
        return result;
      };
    };

    return {
      cancel: wrapMutator(baseMutators.cancel),
      post: wrapMutator(baseMutators.post),
      submit: wrapMutator(baseMutators.submit),
    };
  }, []);

  if (isLegacyCreateRoute) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <div className="flex w-full flex-wrap justify-start gap-2 md:w-auto md:justify-end">
              <PrintFormActions
                client={{ baseUrl: API_BASE_URL, credentials: "include" }}
                forms={document.printForms}
                owner={{
                  type: "document",
                  docType: document.docType,
                  documentId: document.id,
                }}
              />
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
          formDefinitions={CRM_DOCUMENT_FORM_DEFINITIONS}
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
