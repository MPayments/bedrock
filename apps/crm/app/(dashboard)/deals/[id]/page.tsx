"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { API_BASE_URL } from "@/lib/constants";
import { AgreementCard } from "./_components/agreement-card";
import { AttachmentsCard } from "./_components/attachments-card";
import { CalculationDialog } from "./_components/calculation-dialog";
import { CustomerCard } from "./_components/customer-card";
import { DealHeader } from "./_components/deal-header";
import { DealInfoCard } from "./_components/deal-info-card";
import { ErrorDialog } from "./_components/error-dialog";
import { FinancialCard } from "./_components/financial-card";
import { FormalDocumentsCard } from "./_components/formal-documents-card";
import { LegalEntityCard } from "./_components/legal-entity-card";
import { OrganizationCard } from "./_components/organization-card";
import { OrganizationRequisiteCard } from "./_components/organization-requisite-card";
import { StatusHistoryCard } from "./_components/status-history-card";
import { UploadAttachmentDialog } from "./_components/upload-attachment-dialog";
import { STATUS_LABELS, VALID_TRANSITIONS } from "./_components/constants";
import {
  decimalToMinorString,
  feeBpsToPercentString,
  formatDateTimeInput,
  minorToDecimalString,
  rationalToDecimalString,
} from "./_components/format";
import type {
  ApiAgreementDetails,
  ApiAttachment,
  ApiCalculationDetails,
  ApiCurrency,
  ApiCurrencyOption,
  ApiCustomerLegalEntity,
  ApiCustomerWorkspace,
  ApiDealCalculationHistoryItem,
  ApiDealDetails,
  ApiFormalDocument,
  ApiOrganization,
  ApiRequisite,
  ApiRequisiteProvider,
  CalculationHistoryView,
  CalculationView,
  DealStatus,
} from "./_components/types";

type DealPageData = {
  agreement: ApiAgreementDetails;
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  calculationHistory: CalculationHistoryView[];
  customer: ApiCustomerWorkspace;
  deal: ApiDealDetails;
  formalDocuments: ApiFormalDocument[];
  legalEntity: ApiCustomerLegalEntity | null;
  organization: ApiOrganization;
  organizationRequisite: ApiRequisite;
  organizationRequisiteProvider: ApiRequisiteProvider | null;
  requestedCurrency: ApiCurrency | null;
  currencyOptions: ApiCurrencyOption[];
};

function getStatusOptions(status: DealStatus) {
  return VALID_TRANSITIONS[status] ?? [];
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
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

async function fetchCalculationView(
  calculationId: string,
): Promise<CalculationView> {
  const calculation = await fetchJson<ApiCalculationDetails>(
    `${API_BASE_URL}/calculations/${calculationId}`,
  );

  const currencyIds = [
    calculation.currentSnapshot.calculationCurrencyId,
    calculation.currentSnapshot.baseCurrencyId,
    calculation.currentSnapshot.additionalExpensesCurrencyId,
  ].filter((value): value is string => Boolean(value));

  const uniqueCurrencyIds = [...new Set(currencyIds)];
  const currencies = await Promise.all(
    uniqueCurrencyIds.map((id) =>
      fetchJson<ApiCurrency>(`${API_BASE_URL}/currencies/${id}`),
    ),
  );
  const currenciesById = new Map(currencies.map((currency) => [currency.id, currency]));

  const calculationCurrency = currenciesById.get(
    calculation.currentSnapshot.calculationCurrencyId,
  );
  const baseCurrency = currenciesById.get(calculation.currentSnapshot.baseCurrencyId);

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Не удалось загрузить валюты расчета");
  }

  const additionalExpensesCurrency =
    calculation.currentSnapshot.additionalExpensesCurrencyId
      ? currenciesById.get(calculation.currentSnapshot.additionalExpensesCurrencyId) ??
        null
      : null;

  return {
    additionalExpenses: minorToDecimalString(
      calculation.currentSnapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    additionalExpensesCurrencyCode: additionalExpensesCurrency?.code ?? null,
    additionalExpensesInBase: minorToDecimalString(
      calculation.currentSnapshot.additionalExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    currencyCode: calculationCurrency.code,
    feeAmount: minorToDecimalString(
      calculation.currentSnapshot.feeAmountMinor,
      calculationCurrency.precision,
    ),
    feeAmountInBase: minorToDecimalString(
      calculation.currentSnapshot.feeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    feePercentage: feeBpsToPercentString(calculation.currentSnapshot.feeBps),
    originalAmount: minorToDecimalString(
      calculation.currentSnapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    rate: rationalToDecimalString(
      calculation.currentSnapshot.rateNum,
      calculation.currentSnapshot.rateDen,
    ),
    totalAmount: minorToDecimalString(
      calculation.currentSnapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    totalInBase: minorToDecimalString(
      calculation.currentSnapshot.totalInBaseMinor,
      baseCurrency.precision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      calculation.currentSnapshot.totalWithExpensesInBaseMinor,
      baseCurrency.precision,
    ),
  };
}

async function fetchCalculationHistory(
  dealId: string,
): Promise<CalculationHistoryView[]> {
  const history = await fetchJson<ApiDealCalculationHistoryItem[]>(
    `${API_BASE_URL}/deals/${dealId}/calculations`,
  );

  return history.map((item) => ({
    calculationId: item.calculationId,
    calculationTimestamp: item.calculationTimestamp,
    createdAt: item.createdAt,
    fxQuoteId: item.fxQuoteId,
    rate: rationalToDecimalString(item.rateNum, item.rateDen),
  }));
}

async function fetchCurrencyOptions(): Promise<ApiCurrencyOption[]> {
  const response = await fetchJson<{ data: ApiCurrencyOption[] }>(
    `${API_BASE_URL}/currencies/options`,
  );

  return response.data;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveDefaultToCurrency(
  options: ApiCurrencyOption[],
  fromCurrencyCode: string | null,
) {
  if (options.length === 0) {
    return "";
  }

  if (!fromCurrencyCode) {
    return options[0]?.code ?? "";
  }

  return options.find((option) => option.code !== fromCurrencyCode)?.code ?? "";
}

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = params?.id as string;

  const [data, setData] = useState<DealPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
  }>({
    isOpen: false,
    message: "",
    title: "",
  });
  const [isCalculationDialogOpen, setIsCalculationDialogOpen] = useState(false);
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const [overrideCalculationAmount, setOverrideCalculationAmount] =
    useState(false);
  const [calculationAmount, setCalculationAmount] = useState("");
  const [calculationToCurrency, setCalculationToCurrency] = useState("");
  const [calculationAsOf, setCalculationAsOf] = useState(
    formatDateTimeInput(new Date()),
  );

  const showError = useCallback((title: string, message: string) => {
    setErrorDialog({
      isOpen: true,
      message,
      title,
    });
  }, []);

  const loadDeal = useCallback(async () => {
    if (!dealId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const deal = await fetchJson<ApiDealDetails>(`${API_BASE_URL}/deals/${dealId}`);
      const counterpartyId =
        deal.participants.find(
          (participant) => participant.role === "counterparty",
        )?.counterpartyId ?? null;

      const [
        attachments,
        customer,
        agreement,
        formalDocuments,
        requestedCurrency,
        calculation,
        calculationHistory,
        currencyOptions,
      ] = await Promise.all([
        fetchJson<ApiAttachment[]>(`${API_BASE_URL}/deals/${dealId}/attachments`),
        fetchJson<ApiCustomerWorkspace>(
          `${API_BASE_URL}/customers/${deal.customerId}`,
        ),
        fetchJson<ApiAgreementDetails>(
          `${API_BASE_URL}/agreements/${deal.agreementId}`,
        ),
        fetchJson<ApiFormalDocument[]>(
          `${API_BASE_URL}/deals/${dealId}/formal-documents`,
        ),
        deal.requestedCurrencyId
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${deal.requestedCurrencyId}`,
            )
          : Promise.resolve(null),
        deal.calculationId
          ? fetchCalculationView(deal.calculationId)
          : Promise.resolve(null),
        fetchCalculationHistory(dealId),
        fetchCurrencyOptions(),
      ]);

      const legalEntity = counterpartyId
        ? customer.legalEntities.find(
            (candidate) => candidate.counterpartyId === counterpartyId,
          ) ?? null
        : null;

      const [organization, organizationRequisite] = await Promise.all([
        fetchJson<ApiOrganization>(
          `${API_BASE_URL}/organizations/${agreement.organizationId}`,
        ),
        fetchJson<ApiRequisite>(
          `${API_BASE_URL}/requisites/${agreement.organizationRequisiteId}`,
        ),
      ]);

      const organizationRequisiteProvider = await fetchJson<ApiRequisiteProvider | null>(
        `${API_BASE_URL}/requisites/${agreement.organizationRequisiteId}/provider`,
      );

      setData({
        agreement,
        attachments,
        calculation,
        calculationHistory,
        currencyOptions,
        customer,
        deal,
        formalDocuments,
        legalEntity,
        organization,
        organizationRequisite,
        organizationRequisiteProvider,
        requestedCurrency,
      });
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

  useEffect(() => {
    if (!data || overrideCalculationAmount) {
      return;
    }

    setCalculationAmount(data.deal.requestedAmount ?? "");
  }, [data, overrideCalculationAmount]);

  useEffect(() => {
    if (!data || calculationToCurrency) {
      return;
    }

    setCalculationToCurrency(
      resolveDefaultToCurrency(
        data.currencyOptions,
        data.requestedCurrency?.code ?? null,
      ),
    );
  }, [calculationToCurrency, data]);

  const handleOpenCalculationDialog = useCallback(() => {
    if (!data) {
      return;
    }

    setOverrideCalculationAmount(false);
    setCalculationAmount(data.deal.requestedAmount ?? "");
    setCalculationToCurrency(
      resolveDefaultToCurrency(
        data.currencyOptions,
        data.requestedCurrency?.code ?? null,
      ),
    );
    setCalculationAsOf(formatDateTimeInput(new Date()));
    setIsCalculationDialogOpen(true);
  }, [data]);

  const handleCreateCalculation = useCallback(async () => {
    if (!data) {
      return;
    }

    if (!data.requestedCurrency || !data.deal.requestedAmount) {
      showError(
        "Недостаточно данных",
        "Для расчета нужна запрошенная сумма и валюта сделки.",
      );
      return;
    }

    if (!calculationToCurrency) {
      showError("Недостаточно данных", "Выберите валюту назначения.");
      return;
    }

    if (calculationToCurrency === data.requestedCurrency.code) {
      showError("Недопустимая валютная пара", "Выберите другую валюту.");
      return;
    }

    const amountSource = overrideCalculationAmount
      ? calculationAmount
      : data.deal.requestedAmount;
    const amountMinor = decimalToMinorString(
      amountSource,
      data.requestedCurrency.precision,
    );

    if (!amountMinor || BigInt(amountMinor) <= 0n) {
      showError(
        "Некорректная сумма",
        "Введите сумму больше нуля в формате 1000.00.",
      );
      return;
    }

    const asOfDate = calculationAsOf
      ? new Date(calculationAsOf)
      : new Date();

    if (Number.isNaN(asOfDate.getTime())) {
      showError("Некорректная дата", "Выберите дату расчета.");
      return;
    }

    try {
      setIsCreatingCalculation(true);

      const quote = await fetchJson<{ id: string }>(
        `${API_BASE_URL}/deals/${dealId}/quotes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            mode: "auto_cross",
            fromCurrency: data.requestedCurrency.code,
            toCurrency: calculationToCurrency,
            fromAmountMinor: amountMinor,
            asOf: asOfDate.toISOString(),
          }),
        },
      );

      await fetchJson(
        `${API_BASE_URL}/deals/${dealId}/quotes/${quote.id}/accept`,
        {
          method: "POST",
        },
      );

      await fetchJson(
        `${API_BASE_URL}/deals/${dealId}/calculations/from-quote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({ quoteId: quote.id }),
        },
      );

      setIsCalculationDialogOpen(false);
      await loadDeal();
    } catch (nextError) {
      console.error("Calculation creation error:", nextError);
      showError(
        "Ошибка создания расчета",
        nextError instanceof Error
          ? nextError.message
          : "Не удалось создать расчет",
      );
    } finally {
      setIsCreatingCalculation(false);
    }
  }, [
    calculationAmount,
    calculationAsOf,
    calculationToCurrency,
    data,
    dealId,
    loadDeal,
    overrideCalculationAmount,
    showError,
  ]);

  const calculationTypeSupported = data
    ? ["payment", "currency_exchange"].includes(data.deal.type)
    : false;
  const calculationStatusAllowed = data
    ? !["draft", "rejected", "done", "cancelled"].includes(data.deal.status)
    : false;
  const calculationHasRequestedAmount = Boolean(
    data?.deal.requestedAmount && data?.requestedCurrency,
  );
  const calculationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : !calculationTypeSupported
      ? "В этой версии расчет доступен только для платежей и конверсий."
      : !calculationStatusAllowed
        ? `Нельзя создать расчет для статуса "${STATUS_LABELS[data.deal.status]}".`
        : !calculationHasRequestedAmount
          ? "У сделки нет запрошенной суммы или валюты."
          : null;

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

  const handleEditComment = useCallback(() => {
    setCommentValue(data?.deal.comment ?? "");
    setIsEditingComment(true);
  }, [data?.deal.comment]);

  const handleCancelEditComment = useCallback(() => {
    setCommentValue("");
    setIsEditingComment(false);
  }, []);

  const handleSaveComment = useCallback(async () => {
    try {
      setIsSavingComment(true);

      const response = await fetch(`${API_BASE_URL}/deals/${dealId}/intake`, {
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

      const response = await fetch(`${API_BASE_URL}/deals/${dealId}/attachments`, {
        body: formData,
        credentials: "include",
        method: "POST",
      });

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
  }, [dealId, loadDeal, showError, uploadDescription, uploadFile]);

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

  const statusOptions = getStatusOptions(data.deal.status);

  return (
    <div className="space-y-6">
      <DealHeader
        dealId={data.deal.id}
        status={data.deal.status}
        statusOptions={statusOptions}
        isUpdatingStatus={isUpdatingStatus}
        onBack={() => router.back()}
        onStatusChange={handleStatusUpdate}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <DealInfoCard
            deal={data.deal}
            requestedCurrency={data.requestedCurrency}
            isEditingComment={isEditingComment}
            commentValue={commentValue}
            isSavingComment={isSavingComment}
            onEditComment={handleEditComment}
            onCancelEdit={handleCancelEditComment}
            onCommentChange={setCommentValue}
            onSaveComment={handleSaveComment}
          />
          <FinancialCard
            calculation={data.calculation}
            calculationHistory={data.calculationHistory}
            activeCalculationId={data.deal.calculationId}
            disabledReason={calculationDisabledReason}
            isCreating={isCreatingCalculation}
            onCreate={handleOpenCalculationDialog}
          />
          <FormalDocumentsCard documents={data.formalDocuments} />
          <AttachmentsCard
            attachments={data.attachments}
            deletingAttachmentId={deletingAttachmentId}
            onUpload={() => setIsUploadDialogOpen(true)}
            onDownload={(attachmentId) => {
              window.open(
                `${API_BASE_URL}/deals/${dealId}/attachments/${attachmentId}/download`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
            onDelete={handleAttachmentDelete}
          />
        </div>

        <div className="space-y-6">
          <CustomerCard customer={data.customer} />
          <LegalEntityCard legalEntity={data.legalEntity} />
          <AgreementCard agreement={data.agreement} />
          <OrganizationCard organization={data.organization} />
          <OrganizationRequisiteCard
            requisite={data.organizationRequisite}
            provider={data.organizationRequisiteProvider}
          />
          <StatusHistoryCard statusHistory={data.deal.statusHistory} />
        </div>
      </div>

      <CalculationDialog
        open={isCalculationDialogOpen}
        onOpenChange={(open) => {
          setIsCalculationDialogOpen(open);
          if (!open) {
            setOverrideCalculationAmount(false);
          }
        }}
        requestedCurrency={data.requestedCurrency}
        currencyOptions={data.currencyOptions}
        amount={calculationAmount}
        overrideAmount={overrideCalculationAmount}
        toCurrency={calculationToCurrency}
        asOf={calculationAsOf}
        disabledReason={calculationDisabledReason}
        isCreating={isCreatingCalculation}
        onToggleOverride={setOverrideCalculationAmount}
        onAmountChange={setCalculationAmount}
        onToCurrencyChange={setCalculationToCurrency}
        onAsOfChange={setCalculationAsOf}
        onSubmit={handleCreateCalculation}
        onCancel={() => setIsCalculationDialogOpen(false)}
      />

      <UploadAttachmentDialog
        open={isUploadDialogOpen}
        uploadFile={uploadFile}
        uploadDescription={uploadDescription}
        isUploading={isUploadingAttachment}
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open);
          if (!open) {
            setUploadDescription("");
            setUploadFile(null);
          }
        }}
        onFileChange={setUploadFile}
        onDescriptionChange={setUploadDescription}
        onCancel={() => {
          setIsUploadDialogOpen(false);
          setUploadDescription("");
          setUploadFile(null);
        }}
        onSubmit={handleAttachmentUpload}
      />

      <ErrorDialog
        open={errorDialog.isOpen}
        title={errorDialog.title}
        message={errorDialog.message}
        onOpenChange={(open) =>
          setErrorDialog((current) => ({ ...current, isOpen: open }))
        }
      />
    </div>
  );
}
