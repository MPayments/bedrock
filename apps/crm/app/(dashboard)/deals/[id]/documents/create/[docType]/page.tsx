"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";

import { Loader2 } from "lucide-react";
import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";
import { DocumentCreateForm } from "@bedrock/sdk-documents-form-ui/components/document-create-form";

import { DEAL_TYPE_LABELS } from "@/app/(dashboard)/deals/[id]/_components/constants";
import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";
import { formatDealBreadcrumbLabel } from "@/components/app/breadcrumbs";
import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import { buildCrmDealDocumentInitialPayload } from "@/features/documents/lib/deal-prefill";
import { canCreateCrmDocumentType, getCrmDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { fetchCrmDocumentFormOptions } from "@/features/documents/lib/form-options";
import {
  createDealScopedDocumentDraft,
  updateDocumentDraft,
} from "@/features/documents/lib/mutations";
import {
  buildCrmDealDocumentCreateHref,
  buildCrmDealDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import { API_BASE_URL } from "@/lib/constants";

export default function DealDocumentCreatePage() {
  const params = useParams<{ id: string; docType: string }>();
  const dealId = params?.id ?? "";
  const docType = params?.docType ?? "";

  const [workbench, setWorkbench] =
    useState<ApiCrmDealWorkbenchProjection | null>(null);
  const [formOptions, setFormOptions] = useState<DocumentFormOptions | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useCrmBreadcrumbs(
    docType && dealId
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
            href: buildCrmDealDocumentCreateHref(dealId, docType),
            label: `Создание ${getCrmDocumentTypeLabel(docType).toLowerCase()}`,
          },
        ]
      : [],
  );

  if (!docType || !canCreateCrmDocumentType(docType)) {
    notFound();
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [workbenchResponse, options] = await Promise.all([
          fetch(`${API_BASE_URL}/deals/${dealId}/crm-workbench`, {
            cache: "no-store",
            credentials: "include",
          }).then((r) => (r.ok ? r.json() : null)),
          fetchCrmDocumentFormOptions(),
        ]);
        if (cancelled) return;
        if (!workbenchResponse) {
          setError("Сделка не найдена");
        } else {
          const data = workbenchResponse as { workbench: ApiCrmDealWorkbenchProjection };
          setWorkbench(data.workbench);
        }
        setFormOptions(options);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Не удалось загрузить данные",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const initialPayload = useMemo(() => {
    if (!workbench) return undefined;
    return buildCrmDealDocumentInitialPayload(workbench, docType);
  }, [docType, workbench]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workbench || !formOptions) {
    return (
      <div className="space-y-4 py-8">
        <p className="text-sm text-destructive">
          {error ?? "Не удалось загрузить данные сделки"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocumentCreateForm
        dealId={dealId}
        docType={docType}
        docTypeLabel={getCrmDocumentTypeLabel(docType)}
        initialPayload={initialPayload}
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
        updateMutator={async ({ docType: type, documentId, payload }) =>
          updateDocumentDraft({ docType: type, documentId, payload })
        }
        buildSuccessHref={({ docType: type, documentId }) =>
          buildCrmDealDocumentDetailsHref(dealId, type, documentId)
        }
      />
    </div>
  );
}
