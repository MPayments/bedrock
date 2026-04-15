"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { Button } from "@bedrock/sdk-ui/components/button";

import { API_BASE_URL } from "@/lib/constants";
import { AgreementCard } from "./_components/agreement-card";
import { DealDocumentsTab } from "./_components/deal-documents-tab";
import { DealManagementCard } from "./_components/deal-management-card";
import { DealProfitabilityCard } from "./_components/deal-profitability-card";
import { DealReconciliationExceptionsCard } from "./_components/deal-reconciliation-exceptions-card";
import { DealTimelineCard } from "./_components/deal-timeline-card";
import {
  DealTabs,
  DEFAULT_DEAL_PAGE_TAB,
  isDealPageTab,
  type DealPageTab,
} from "./_components/deal-tabs";
import { DealExecutionTab } from "./_components/deal-execution-tab";
import { DealHeader } from "./_components/deal-header";
import { DealOverviewTab } from "./_components/deal-overview-tab";
import { DealPricingTab } from "./_components/deal-pricing-tab";
import { DealQuestionnaireTab } from "./_components/deal-questionnaire-tab";
import { ErrorDialog } from "./_components/error-dialog";
import { UploadAttachmentDialog } from "./_components/upload-attachment-dialog";
import {
  REQUIRED_DEAL_SECTION_IDS_BY_TYPE,
  formatDealWorkflowMessage,
  getDealWorkflowMessageTone,
  STATUS_LABELS,
} from "./_components/constants";
import type {
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
  ApiDealTransitionBlocker,
  DealLegState,
  DealStatus,
} from "./_components/types";

type DealPageData = {
  currency: ApiCurrency | null;
  workbench: ApiCrmDealWorkbenchProjection;
};

type DealAgreementOption = {
  currentVersion: {
    contractNumber: string | null;
    versionNumber: number;
  };
  id: string;
  isActive: boolean;
};

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      code?: string;
      details?: {
        blockers?: ApiDealTransitionBlocker[];
      };
      error?: string;
      message?: string;
    };

    if (
      payload.code === "deal.transition_blocked" &&
      payload.details?.blockers?.length
    ) {
      return payload.details.blockers
        .map((blocker) => formatDealWorkflowMessage(blocker.message))
        .join("\n");
    }

    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function getPricingQuoteAmountSide(workbench: ApiCrmDealWorkbenchProjection) {
  return workbench.summary.type === "payment" ? "target" : "source";
}

function formatBlockers(blockers: ApiDealTransitionBlocker[]) {
  return blockers
    .map((blocker) => `• ${formatDealWorkflowMessage(blocker.message)}`)
    .join("\n");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, `Ошибка запроса: ${response.status}`),
    );
  }

  return (await response.json()) as T;
}

export default function DealDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const dealId = params?.id as string;

  const [data, setData] = useState<DealPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [agreementOptions, setAgreementOptions] = useState<
    DealAgreementOption[]
  >([]);
  const [isUpdatingAgreement, setIsUpdatingAgreement] = useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadPurpose, setUploadPurpose] = useState<
    "invoice" | "contract" | "other"
  >("other");
  const [uploadVisibility, setUploadVisibility] = useState<
    "customer_safe" | "internal"
  >("internal");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [reingestingAttachmentId, setReingestingAttachmentId] = useState<
    string | null
  >(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    variant: "default" | "destructive";
  }>({
    isOpen: false,
    message: "",
    title: "",
    variant: "default",
  });

  const activeTab = useMemo<DealPageTab>(() => {
    const tabParam = searchParams.get("tab");
    return isDealPageTab(tabParam) ? tabParam : DEFAULT_DEAL_PAGE_TAB;
  }, [searchParams]);

  const showError = useCallback(
    (
      title: string,
      message: string,
      variant: "default" | "destructive" = "destructive",
    ) => {
      setErrorDialog({
        isOpen: true,
        message,
        title,
        variant,
      });
    },
    [],
  );

  const handleTabChange = useCallback(
    (tab: DealPageTab) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      if (tab === DEFAULT_DEAL_PAGE_TAB) {
        nextSearchParams.delete("tab");
      } else {
        nextSearchParams.set("tab", tab);
      }

      const nextQuery = nextSearchParams.toString();
      const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;

      startTransition(() => {
        router.replace(nextHref, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const loadDeal = useCallback(async () => {
    if (!dealId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const workbench = await fetchJson<ApiCrmDealWorkbenchProjection>(
        `${API_BASE_URL}/deals/${dealId}/crm-workbench`,
      );

      if (
        !workbench.context.agreement ||
        !workbench.context.customer ||
        !workbench.context.internalEntity ||
        !workbench.context.internalEntityRequisite
      ) {
        throw new Error("Не удалось собрать контекст сделки для CRM.");
      }

      const customerId =
        workbench.context.customer?.customer.id ??
        workbench.participants.find(
          (participant) => participant.role === "customer",
        )?.customerId ??
        null;

      const [currency, agreementsPayload] = await Promise.all([
        (workbench.summary.type === "payment"
          ? workbench.header.moneyRequest.targetCurrencyId
          : workbench.header.moneyRequest.sourceCurrencyId)
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${
                workbench.summary.type === "payment"
                  ? workbench.header.moneyRequest.targetCurrencyId
                  : workbench.header.moneyRequest.sourceCurrencyId
              }`,
            )
          : Promise.resolve(null),
        customerId
          ? fetchJson<{ data: DealAgreementOption[] }>(
              `${API_BASE_URL}/agreements?customerId=${customerId}&limit=${MAX_QUERY_LIST_LIMIT}&offset=0`,
            )
          : Promise.resolve({ data: [] }),
      ]);

      setData({ currency, workbench });
      setAgreementOptions(agreementsPayload.data);
    } catch (nextError) {
      console.error("Deal detail load error:", nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Не удалось загрузить сделку",
      );
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadDeal();
  }, [loadDeal]);
  const calculationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : data.workbench.summary.calculationId
      ? "По сделке уже привязан актуальный расчет."
      : "Создание и фиксация расчета выполняются в Finance.";

  const handleStatusUpdate = useCallback(
    async (status: DealStatus) => {
      try {
        setIsUpdatingStatus(true);

        const response = await fetch(`${API_BASE_URL}/deals/${dealId}/status`, {
          body: JSON.stringify({ status }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка обновления статуса: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal status update error:", nextError);
        showError(
          "Ошибка обновления статуса",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось обновить статус сделки",
        );
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [dealId, loadDeal, showError],
  );

  const handleBlockedTransitionClick = useCallback(
    (status: DealStatus) => {
      const readiness = data?.workbench.transitionReadiness.find(
        (item) => item.targetStatus === status,
      );
      const blockers = readiness?.blockers ?? [];
      const isWarning =
        blockers.length > 0 &&
        blockers.every(
          (blocker) =>
            getDealWorkflowMessageTone(blocker.message) === "warning",
        );

      showError(
        isWarning ? "Нужно заполнить заголовок сделки" : "Переход заблокирован",
        blockers.length
          ? formatBlockers(blockers)
          : `Переход в статус "${STATUS_LABELS[status]}" сейчас недоступен.`,
        isWarning ? "default" : "destructive",
      );
    },
    [data?.workbench.transitionReadiness, showError],
  );

  const handleEditComment = useCallback(() => {
    setCommentValue(data?.workbench.comment ?? "");
    setIsEditingComment(true);
  }, [data?.workbench.comment]);

  const handleCancelEditComment = useCallback(() => {
    setCommentValue("");
    setIsEditingComment(false);
  }, []);

  const handleSaveComment = useCallback(async () => {
    try {
      setIsSavingComment(true);

      const response = await fetch(`${API_BASE_URL}/deals/${dealId}/comment`, {
        body: JSON.stringify({ comment: commentValue }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            `Ошибка сохранения комментария: ${response.status}`,
          ),
        );
      }

      setIsEditingComment(false);
      await loadDeal();
    } catch (nextError) {
      console.error("Deal comment update error:", nextError);
      showError(
        "Ошибка сохранения комментария",
        nextError instanceof Error
          ? nextError.message
          : "Не удалось сохранить комментарий",
      );
    } finally {
      setIsSavingComment(false);
    }
  }, [commentValue, dealId, loadDeal, showError]);

  const handleAgreementChange = useCallback(
    async (agreementId: string) => {
      if (!data || agreementId === data.workbench.context.agreement?.id) {
        return;
      }

      try {
        setIsUpdatingAgreement(true);

        const response = await fetch(
          `${API_BASE_URL}/deals/${dealId}/agreement`,
          {
            body: JSON.stringify({ agreementId }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка изменения договора: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal agreement update error:", nextError);
        showError(
          "Ошибка изменения договора",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось изменить договор сделки",
        );
      } finally {
        setIsUpdatingAgreement(false);
      }
    },
    [data, dealId, loadDeal, showError],
  );

  const handleAssigneeChange = useCallback(
    async (agentId: string | undefined) => {
      if (!data || agentId === (data.workbench.assignee.userId ?? undefined)) {
        return;
      }

      try {
        setIsUpdatingAssignee(true);

        const response = await fetch(
          `${API_BASE_URL}/deals/${dealId}/assignee`,
          {
            body: JSON.stringify({ agentId: agentId ?? null }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка изменения исполнителя: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal assignee update error:", nextError);
        showError(
          "Ошибка изменения исполнителя",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось изменить исполнителя сделки",
        );
      } finally {
        setIsUpdatingAssignee(false);
      }
    },
    [data, dealId, loadDeal, showError],
  );

  const handleAttachmentUpload = useCallback(async () => {
    if (!uploadFile) {
      showError("Файл не выбран", "Выберите файл для загрузки");
      return;
    }

    try {
      setIsUploadingAttachment(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }
      formData.append("purpose", uploadPurpose);
      formData.append("visibility", uploadVisibility);

      const response = await fetch(
        `${API_BASE_URL}/deals/${dealId}/attachments`,
        {
          body: formData,
          credentials: "include",
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            `Ошибка загрузки вложения: ${response.status}`,
          ),
        );
      }

      setIsUploadDialogOpen(false);
      setUploadDescription("");
      setUploadFile(null);
      setUploadPurpose("other");
      setUploadVisibility("internal");
      await loadDeal();
    } catch (nextError) {
      console.error("Deal attachment upload error:", nextError);
      showError(
        "Ошибка загрузки вложения",
        nextError instanceof Error
          ? nextError.message
          : "Не удалось загрузить вложение",
      );
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [
    dealId,
    loadDeal,
    showError,
    uploadDescription,
    uploadFile,
    uploadPurpose,
    uploadVisibility,
  ]);

  const handleAttachmentDelete = useCallback(
    async (attachmentId: string) => {
      try {
        setDeletingAttachmentId(attachmentId);

        const response = await fetch(
          `${API_BASE_URL}/deals/${dealId}/attachments/${attachmentId}`,
          {
            credentials: "include",
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка удаления вложения: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal attachment delete error:", nextError);
        showError(
          "Ошибка удаления вложения",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось удалить вложение",
        );
      } finally {
        setDeletingAttachmentId(null);
      }
    },
    [dealId, loadDeal, showError],
  );

  const handleAttachmentDownload = useCallback(
    (attachmentId: string) => {
      window.open(
        `${API_BASE_URL}/deals/${dealId}/attachments/${attachmentId}/download`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [dealId],
  );

  const handleOpenAttachmentDialog = useCallback(() => {
    const hasInvoiceAttachment = data?.workbench.relatedResources.attachments.some(
      (attachment) => attachment.purpose === "invoice",
    );
    setUploadPurpose(
      data?.workbench.summary.type === "payment" && !hasInvoiceAttachment
        ? "invoice"
        : "other",
    );
    setUploadVisibility("internal");
    setIsUploadDialogOpen(true);
  }, [data]);

  const handleAttachmentReingest = useCallback(
    async (attachmentId: string) => {
      try {
        setReingestingAttachmentId(attachmentId);

        const response = await fetch(
          `${API_BASE_URL}/deals/${dealId}/attachments/${attachmentId}/reingest`,
          {
            credentials: "include",
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка повторного распознавания: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal attachment reingest error:", nextError);
        showError(
          "Ошибка повторного распознавания",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось повторно отправить файл на распознавание",
        );
      } finally {
        setReingestingAttachmentId(null);
      }
    },
    [dealId, loadDeal, showError],
  );

  const handleHeaderSave = useCallback(
    async (header: ApiCrmDealWorkbenchProjection["header"]) => {
      if (!data) {
        throw new Error("Данные сделки еще не загружены.");
      }

      try {
        setIsSavingHeader(true);

        const response = await fetch(`${API_BASE_URL}/deals/${dealId}/header`, {
          body: JSON.stringify({
            expectedRevision: data.workbench.revision,
            header,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка сохранения анкеты: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal header update error:", nextError);
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Не удалось сохранить анкету сделки";
        showError("Ошибка сохранения анкеты", message);
        throw nextError;
      } finally {
        setIsSavingHeader(false);
      }
    },
    [data, dealId, loadDeal, showError],
  );

  const tabBadges = useMemo(() => {
    if (!data) {
      return {};
    }

    const requiredSections = new Set(
      REQUIRED_DEAL_SECTION_IDS_BY_TYPE[data.workbench.summary.type],
    );

    const missingEvidenceCount = data.workbench.evidenceRequirements.filter(
      (requirement) => requirement.state === "missing",
    ).length;
    const missingDocumentCount = data.workbench.documentRequirements.filter(
      (requirement) => requirement.state === "missing",
    ).length;
    const blockedLegCount = data.workbench.executionPlan.filter(
      (leg) => leg.state === "blocked",
    ).length;
    const blockedPositionCount =
      data.workbench.operationalState.positions.filter(
        (position) => position.state === "blocked",
      ).length;

    return {
      questionnaire: data.workbench.sectionCompleteness.filter(
        (section) =>
          requiredSections.has(section.sectionId) && !section.complete,
      ).length,
      documents: missingEvidenceCount + missingDocumentCount,
      execution: blockedLegCount + blockedPositionCount,
    } satisfies Partial<Record<DealPageTab, number | string | null>>;
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-lg text-muted-foreground">Загрузка сделки...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error ?? "Не удалось загрузить сделку"}
        </div>
      </div>
    );
  }

  const agreement = data.workbench.context.agreement;

  if (!agreement) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          Не удалось собрать CRM-контекст сделки.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DealHeader
        isUpdatingStatus={isUpdatingStatus}
        onBack={() => router.back()}
        onBlockedStatusClick={handleBlockedTransitionClick}
        onStatusChange={handleStatusUpdate}
        workbench={data.workbench}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_1px_minmax(320px,1fr)]">
        <div className="space-y-6">
          <DealTabs
            activeTab={activeTab}
            badges={tabBadges}
            onTabChange={handleTabChange}
            overview={
              <DealOverviewTab
                commentValue={commentValue}
                isEditingComment={isEditingComment}
                isSavingComment={isSavingComment}
                onCancelEdit={handleCancelEditComment}
                onCommentChange={setCommentValue}
                onEditComment={handleEditComment}
                onSaveComment={handleSaveComment}
                currency={data.currency}
                workbench={data.workbench}
              />
            }
            questionnaire={
              <DealQuestionnaireTab
                isSaving={isSavingHeader}
                onSubmit={handleHeaderSave}
                workbench={data.workbench}
              />
            }
            pricing={
              <DealPricingTab
                calculationDisabledReason={calculationDisabledReason}
                quoteAmountSide={getPricingQuoteAmountSide(data.workbench)}
                workbench={data.workbench}
              />
            }
            documents={
              <DealDocumentsTab
                deletingAttachmentId={deletingAttachmentId}
                onAttachmentDelete={handleAttachmentDelete}
                onAttachmentDownload={handleAttachmentDownload}
                onAttachmentReingest={handleAttachmentReingest}
                onAttachmentUpload={handleOpenAttachmentDialog}
                reingestingAttachmentId={reingestingAttachmentId}
                workbench={data.workbench}
              />
            }
            execution={
              <DealExecutionTab
                onBlockedTransitionClick={handleBlockedTransitionClick}
                workbench={data.workbench}
              />
            }
          />
        </div>

        <div aria-hidden className="hidden self-stretch bg-border xl:block" />

        <div className="space-y-6">
          <DealManagementCard
            agreementOptions={agreementOptions.map((agreement) => ({
              contractNumber: agreement.currentVersion.contractNumber,
              id: agreement.id,
              isActive: agreement.isActive,
              versionNumber: agreement.currentVersion.versionNumber,
            }))}
            isUpdatingAgreement={isUpdatingAgreement}
            isUpdatingAssignee={isUpdatingAssignee}
            onAgreementChange={handleAgreementChange}
            onAssigneeChange={handleAssigneeChange}
            workbench={data.workbench}
          />
          <DealProfitabilityCard
            profitabilitySnapshot={data.workbench.profitabilitySnapshot}
            profitabilityVariance={data.workbench.profitabilityVariance}
          />
          <DealReconciliationExceptionsCard
            reconciliationExceptions={
              data.workbench.relatedResources.reconciliationExceptions
            }
            reconciliationSummary={data.workbench.reconciliationSummary}
          />
          <DealTimelineCard
            workbench={data.workbench}
          />
          <AgreementCard agreement={agreement} />
        </div>
      </div>

      <UploadAttachmentDialog
        open={isUploadDialogOpen}
        uploadFile={uploadFile}
        uploadDescription={uploadDescription}
        uploadPurpose={uploadPurpose}
        uploadVisibility={uploadVisibility}
        isUploading={isUploadingAttachment}
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open);
          if (!open) {
            setUploadDescription("");
            setUploadFile(null);
            setUploadPurpose("other");
            setUploadVisibility("internal");
          }
        }}
        onFileChange={setUploadFile}
        onDescriptionChange={setUploadDescription}
        onPurposeChange={setUploadPurpose}
        onVisibilityChange={setUploadVisibility}
        onCancel={() => {
          setIsUploadDialogOpen(false);
          setUploadDescription("");
          setUploadFile(null);
          setUploadPurpose("other");
          setUploadVisibility("internal");
        }}
        onSubmit={handleAttachmentUpload}
      />

      <ErrorDialog
        open={errorDialog.isOpen}
        title={errorDialog.title}
        message={errorDialog.message}
        variant={errorDialog.variant}
        onOpenChange={(open) =>
          setErrorDialog((current) => ({ ...current, isOpen: open }))
        }
      />
    </div>
  );
}
