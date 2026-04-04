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
import { CalculationDialog } from "./_components/calculation-dialog";
import { DealDocumentsTab } from "./_components/deal-documents-tab";
import { DealManagementCard } from "./_components/deal-management-card";
import { DealTimelineCard } from "./_components/deal-timeline-card";
import {
  DealTabs,
  DEFAULT_DEAL_PAGE_TAB,
  isDealPageTab,
  type DealPageTab,
} from "./_components/deal-tabs";
import { DealExecutionTab } from "./_components/deal-execution-tab";
import { DealHeader } from "./_components/deal-header";
import { DealIntakeTab } from "./_components/deal-intake-tab";
import { DealOverviewTab } from "./_components/deal-overview-tab";
import { DealPricingTab } from "./_components/deal-pricing-tab";
import { ErrorDialog } from "./_components/error-dialog";
import { UploadAttachmentDialog } from "./_components/upload-attachment-dialog";
import {
  formatDealWorkflowMessage,
  getDealWorkflowMessageTone,
  STATUS_LABELS,
} from "./_components/constants";
import type {
  CrmApplicantRequisiteOption,
  CrmDealIntakeDraft,
} from "../_components/deal-intake-form";
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
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
  ApiCurrencyOption,
  ApiCustomerLegalEntity,
  ApiCustomerWorkspace,
  ApiDealDetails,
  ApiDealTransitionBlocker,
  ApiDealWorkflowProjection,
  ApiFormalDocument,
  ApiOrganization,
  ApiRequisite,
  ApiRequisiteProvider,
  CalculationHistoryView,
  CalculationView,
  DealLegState,
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
  workbench: ApiCrmDealWorkbenchProjection;
  workflow: ApiDealWorkflowProjection;
  currencyOptions: ApiCurrencyOption[];
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

function buildDealViewFromWorkbench(
  workbench: ApiCrmDealWorkbenchProjection,
): ApiDealDetails {
  const customerId =
    workbench.participants.find(
      (participant) => participant.role === "customer",
    )?.customerId ?? "";
  const applicant = workbench.participants.find(
    (participant) => participant.role === "applicant",
  );

  return {
    agreementId: workbench.summary.agreementId,
    agentId: workbench.summary.agentId,
    approvals: workbench.approvals,
    calculationId: workbench.summary.calculationId,
    comment: workbench.intake.common.customerNote,
    createdAt: workbench.summary.createdAt,
    customerId,
    id: workbench.summary.id,
    intakeComment: workbench.intake.common.customerNote,
    participants: [
      ...workbench.participants.map((participant) => {
        const role: ApiDealDetails["participants"][number]["role"] =
          participant.role === "customer"
            ? "customer"
            : participant.role === "internal_entity"
              ? "organization"
              : "counterparty";

        return {
          counterpartyId: participant.counterpartyId,
          customerId: participant.customerId,
          id: participant.id,
          organizationId: participant.organizationId,
          partyId:
            participant.customerId ??
            participant.organizationId ??
            participant.counterpartyId ??
            applicant?.counterpartyId ??
            participant.id,
          role,
        };
      }),
    ],
    reason: workbench.intake.moneyRequest.purpose,
    requestedAmount: workbench.intake.moneyRequest.sourceAmount,
    requestedCurrencyId: workbench.intake.moneyRequest.sourceCurrencyId,
    status: workbench.summary.status,
    statusHistory: workbench.timeline
      .filter(
        (event) =>
          event.type === "deal_created" || event.type === "status_changed",
      )
      .map((event) => ({
        changedBy: event.actor?.userId ?? null,
        comment:
          typeof event.payload.comment === "string"
            ? event.payload.comment
            : null,
        createdAt: event.occurredAt,
        id: event.id,
        status:
          event.type === "status_changed" &&
          typeof event.payload.status === "string"
            ? (event.payload.status as DealStatus)
            : workbench.summary.status,
      })),
    type: workbench.summary.type,
    updatedAt: workbench.summary.updatedAt,
  };
}

function mapRelatedDocumentsToFormalDocuments(
  documents: ApiCrmDealWorkbenchProjection["relatedResources"]["formalDocuments"],
  createdAtFallback: string,
): ApiFormalDocument[] {
  return documents.map((document) => ({
    amount: null,
    approvalStatus: document.approvalStatus ?? "unknown",
    createdAt: document.createdAt ?? document.occurredAt ?? createdAtFallback,
    currency: null,
    docType: document.docType,
    id: document.id,
    lifecycleStatus: document.lifecycleStatus ?? "unknown",
    postingStatus: document.postingStatus ?? "unknown",
    submissionStatus: document.submissionStatus ?? "unknown",
    title: null,
  }));
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

async function fetchCalculationViewFromDetails(
  calculation: ApiCalculationDetails,
): Promise<CalculationView> {
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
  const currenciesById = new Map(
    currencies.map((currency) => [currency.id, currency]),
  );

  const calculationCurrency = currenciesById.get(
    calculation.currentSnapshot.calculationCurrencyId,
  );
  const baseCurrency = currenciesById.get(
    calculation.currentSnapshot.baseCurrencyId,
  );

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Не удалось загрузить валюты расчета");
  }

  const additionalExpensesCurrency = calculation.currentSnapshot
    .additionalExpensesCurrencyId
    ? (currenciesById.get(
        calculation.currentSnapshot.additionalExpensesCurrencyId,
      ) ?? null)
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

function areIntakeDraftsEqual(
  left: CrmDealIntakeDraft | null,
  right: CrmDealIntakeDraft | null,
) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  const [isUpdatingLegKey, setIsUpdatingLegKey] = useState<string | null>(null);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [draftIntake, setDraftIntake] = useState<CrmDealIntakeDraft | null>(
    null,
  );
  const [baselineIntake, setBaselineIntake] =
    useState<CrmDealIntakeDraft | null>(null);
  const [applicantRequisites, setApplicantRequisites] = useState<
    CrmApplicantRequisiteOption[]
  >([]);
  const [agreementOptions, setAgreementOptions] = useState<
    DealAgreementOption[]
  >([]);
  const [isSavingIntake, setIsSavingIntake] = useState(false);
  const [isUpdatingAgreement, setIsUpdatingAgreement] = useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);
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
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isAcceptingQuoteId, setIsAcceptingQuoteId] = useState<string | null>(
    null,
  );
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const [overrideCalculationAmount, setOverrideCalculationAmount] =
    useState(false);
  const [calculationAmount, setCalculationAmount] = useState("");
  const [calculationToCurrency, setCalculationToCurrency] = useState("");
  const [calculationAsOf, setCalculationAsOf] = useState(
    formatDateTimeInput(new Date()),
  );

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
      const deal = buildDealViewFromWorkbench(workbench);

      if (
        !workbench.context.agreement ||
        !workbench.context.customer ||
        !workbench.context.internalEntity ||
        !workbench.context.internalEntityRequisite
      ) {
        throw new Error("Не удалось собрать контекст сделки для CRM.");
      }

      const customerId =
        workbench.context.customer?.id ??
        workbench.participants.find(
          (participant) => participant.role === "customer",
        )?.customerId ??
        null;
      const applicantCounterpartyId =
        workbench.intake.common.applicantCounterpartyId ?? null;

      const [
        requestedCurrency,
        calculation,
        currencyOptions,
        agreementsPayload,
        applicantRequisitesPayload,
      ] = await Promise.all([
        workbench.intake.moneyRequest.sourceCurrencyId
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${workbench.intake.moneyRequest.sourceCurrencyId}`,
            )
          : Promise.resolve(null),
        workbench.pricing.currentCalculation
          ? fetchCalculationViewFromDetails(
              workbench.pricing.currentCalculation,
            )
          : Promise.resolve(null),
        fetchCurrencyOptions(),
        customerId
          ? fetchJson<{ data: DealAgreementOption[] }>(
              `${API_BASE_URL}/agreements?customerId=${customerId}&limit=${MAX_QUERY_LIST_LIMIT}&offset=0`,
            )
          : Promise.resolve({ data: [] }),
        applicantCounterpartyId
          ? fetchJson<{
              data: Array<{
                accountNo: string | null;
                beneficiaryName: string | null;
                iban: string | null;
                id: string;
                label: string;
                provider: { name: string } | null;
              }>;
            }>(
              `${API_BASE_URL}/requisites/bank-workspace?ownerType=counterparty&ownerId=${applicantCounterpartyId}`,
            )
          : Promise.resolve({ data: [] }),
      ]);

      const nextApplicantRequisites = applicantRequisitesPayload.data.map(
        (requisite) => ({
          accountNo: requisite.accountNo,
          beneficiaryName: requisite.beneficiaryName,
          iban: requisite.iban,
          id: requisite.id,
          label: requisite.label,
          providerLabel: requisite.provider?.name ?? null,
        }),
      );

      setData({
        agreement: workbench.context.agreement,
        attachments: workbench.relatedResources.attachments,
        calculation,
        calculationHistory: workbench.pricing.calculationHistory.map(
          (item) => ({
            calculationId: item.calculationId,
            calculationTimestamp: item.calculationTimestamp,
            createdAt: item.createdAt,
            fxQuoteId: item.fxQuoteId,
            rate: rationalToDecimalString(item.rateNum, item.rateDen),
          }),
        ),
        currencyOptions,
        customer: workbench.context.customer,
        deal,
        formalDocuments: mapRelatedDocumentsToFormalDocuments(
          workbench.relatedResources.formalDocuments,
          workbench.summary.createdAt,
        ),
        legalEntity: workbench.context.applicant,
        organization: workbench.context.internalEntity,
        organizationRequisite: workbench.context.internalEntityRequisite,
        organizationRequisiteProvider:
          workbench.context.internalEntityRequisiteProvider,
        requestedCurrency,
        workbench,
        workflow: workbench.workflow,
      });
      setAgreementOptions(agreementsPayload.data);
      setApplicantRequisites(nextApplicantRequisites);
      setDraftIntake(workbench.intake);
      setBaselineIntake(workbench.intake);
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
    const applicantCounterpartyId = draftIntake?.common.applicantCounterpartyId;

    if (!applicantCounterpartyId) {
      setApplicantRequisites([]);
      return;
    }

    let cancelled = false;

    async function loadApplicantRequisites() {
      try {
        const payload = await fetchJson<{
          data: Array<{
            accountNo: string | null;
            beneficiaryName: string | null;
            iban: string | null;
            id: string;
            label: string;
            provider: { name: string } | null;
          }>;
        }>(
          `${API_BASE_URL}/requisites/bank-workspace?ownerType=counterparty&ownerId=${applicantCounterpartyId}`,
        );

        if (cancelled) {
          return;
        }

        setApplicantRequisites(
          payload.data.map((requisite) => ({
            accountNo: requisite.accountNo,
            beneficiaryName: requisite.beneficiaryName,
            iban: requisite.iban,
            id: requisite.id,
            label: requisite.label,
            providerLabel: requisite.provider?.name ?? null,
          })),
        );
      } catch (fetchError) {
        if (!cancelled) {
          console.error("Failed to load applicant requisites", fetchError);
          setApplicantRequisites([]);
        }
      }
    }

    void loadApplicantRequisites();

    return () => {
      cancelled = true;
    };
  }, [draftIntake?.common.applicantCounterpartyId]);

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

  const handleOpenQuoteDialog = useCallback(() => {
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
    setIsQuoteDialogOpen(true);
  }, [data]);

  const handleCreateQuote = useCallback(async () => {
    if (!data) {
      return;
    }

    if (!data.requestedCurrency || !data.deal.requestedAmount) {
      showError(
        "Недостаточно данных",
        "Для запроса котировки нужны сумма и валюта сделки.",
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

    const asOfDate = calculationAsOf ? new Date(calculationAsOf) : new Date();

    if (Number.isNaN(asOfDate.getTime())) {
      showError("Некорректная дата", "Выберите дату котировки.");
      return;
    }

    try {
      setIsCreatingQuote(true);

      await fetchJson<{ id: string }>(
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

      setIsQuoteDialogOpen(false);
      await loadDeal();
    } catch (nextError) {
      console.error("Quote creation error:", nextError);
      showError(
        "Ошибка запроса котировки",
        nextError instanceof Error
          ? nextError.message
          : "Не удалось запросить котировку",
      );
    } finally {
      setIsCreatingQuote(false);
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
    ? data.workbench.pricing.quoteEligibility
    : false;
  const quoteStatusAllowed = data
    ? !["draft", "rejected", "done", "cancelled"].includes(data.deal.status)
    : false;
  const quoteHasRequestedAmount = Boolean(
    data?.deal.requestedAmount && data?.requestedCurrency,
  );
  const isIntakeDirty = !areIntakeDraftsEqual(draftIntake, baselineIntake);
  const quoteCreationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : !calculationTypeSupported
      ? "Котировка доступна только для сделок с обменом валют."
      : !quoteStatusAllowed
        ? `Нельзя запросить котировку для статуса "${STATUS_LABELS[data.deal.status]}".`
        : !quoteHasRequestedAmount
          ? "У сделки нет запрошенной суммы или валюты."
          : null;
  const calculationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : quoteCreationDisabledReason
      ? quoteCreationDisabledReason
      : !data.workbench.acceptedQuote
        ? "Сначала примите котировку."
        : data.workbench.acceptedQuote.quoteStatus !== "active"
          ? "Создать расчет можно только по действующей принятой котировке."
          : null;

  const handleAcceptQuote = useCallback(
    async (quoteId: string) => {
      try {
        setIsAcceptingQuoteId(quoteId);

        await fetchJson(
          `${API_BASE_URL}/deals/${dealId}/quotes/${quoteId}/accept`,
          {
            method: "POST",
          },
        );

        await loadDeal();
      } catch (nextError) {
        console.error("Quote accept error:", nextError);
        showError(
          "Ошибка принятия котировки",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось принять котировку",
        );
      } finally {
        setIsAcceptingQuoteId(null);
      }
    },
    [dealId, loadDeal, showError],
  );

  const handleCreateCalculationFromAcceptedQuote = useCallback(async () => {
    if (!data?.workbench.acceptedQuote) {
      showError("Нет принятой котировки", "Сначала примите котировку.");
      return;
    }

    if (data.workbench.acceptedQuote.quoteStatus !== "active") {
      showError(
        "Котировка недоступна",
        "Создать расчет можно только по действующей принятой котировке.",
      );
      return;
    }

    try {
      setIsCreatingCalculation(true);

      await fetchJson(
        `${API_BASE_URL}/deals/${dealId}/calculations/from-quote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            quoteId: data.workbench.acceptedQuote.quoteId,
          }),
        },
      );

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
  }, [data, dealId, loadDeal, showError]);

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
      const readiness = data?.workflow.transitionReadiness.find(
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
        isWarning ? "Нужно заполнить анкету" : "Переход заблокирован",
        blockers.length
          ? formatBlockers(blockers)
          : `Переход в статус "${STATUS_LABELS[status]}" сейчас недоступен.`,
        isWarning ? "default" : "destructive",
      );
    },
    [data?.workflow.transitionReadiness, showError],
  );

  const handleLegStateUpdate = useCallback(
    async (idx: number, state: DealLegState) => {
      try {
        setIsUpdatingLegKey(String(idx));

        const response = await fetch(
          `${API_BASE_URL}/deals/${dealId}/legs/${idx}/state`,
          {
            body: JSON.stringify({ state }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(
            await parseErrorMessage(
              response,
              `Ошибка обновления этапа исполнения: ${response.status}`,
            ),
          );
        }

        await loadDeal();
      } catch (nextError) {
        console.error("Deal leg state update error:", nextError);
        showError(
          "Ошибка обновления этапа исполнения",
          nextError instanceof Error
            ? nextError.message
            : "Не удалось обновить этап исполнения",
        );
      } finally {
        setIsUpdatingLegKey(null);
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

  const handleSaveIntake = useCallback(async () => {
    if (!data || !draftIntake) {
      return;
    }

    try {
      setIsSavingIntake(true);

      const response = await fetch(`${API_BASE_URL}/deals/${dealId}/intake`, {
        body: JSON.stringify({
          expectedRevision: data.workflow.revision,
          intake: draftIntake,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            `Ошибка сохранения анкеты сделки: ${response.status}`,
          ),
        );
      }

      await loadDeal();
    } catch (nextError) {
      console.error("Deal intake replace error:", nextError);
      showError(
        "Ошибка сохранения анкеты",
        nextError instanceof Error
          ? nextError.message
          : "Не удалось сохранить анкету сделки",
      );
    } finally {
      setIsSavingIntake(false);
    }
  }, [data, dealId, draftIntake, loadDeal, showError]);

  const handleResetIntake = useCallback(() => {
    if (!baselineIntake) {
      return;
    }

    setDraftIntake(baselineIntake);
  }, [baselineIntake]);

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
    const hasInvoiceAttachment = data?.attachments.some(
      (attachment) => attachment.purpose === "invoice",
    );
    setUploadPurpose(
      data?.deal.type === "payment" && !hasInvoiceAttachment
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

  const tabBadges = useMemo(() => {
    if (!data) {
      return {};
    }

    const incompleteSectionCount = data.workflow.sectionCompleteness.filter(
      (section) => !section.complete,
    ).length;
    const missingEvidenceCount = data.workbench.evidenceRequirements.filter(
      (requirement) => requirement.state === "missing",
    ).length;
    const missingDocumentCount = data.workbench.documentRequirements.filter(
      (requirement) => requirement.state === "missing",
    ).length;
    const blockedLegCount = data.workflow.executionPlan.filter(
      (leg) => leg.state === "blocked",
    ).length;
    const blockedPositionCount =
      data.workflow.operationalState.positions.filter(
        (position) => position.state === "blocked",
      ).length;
    const capabilityIssueCount =
      data.workflow.operationalState.capabilities.filter(
        (capability) => capability.status !== "enabled",
      ).length;

    return {
      documents: missingEvidenceCount + missingDocumentCount,
      execution: blockedLegCount + blockedPositionCount + capabilityIssueCount,
      intake:
        incompleteSectionCount > 0
          ? incompleteSectionCount
          : isIntakeDirty
            ? "●"
            : null,
    } satisfies Partial<Record<DealPageTab, number | string | null>>;
  }, [data, isIntakeDirty]);

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

  return (
    <div className="space-y-6">
      <DealHeader
        applicantDisplayName={data.workbench.summary.applicantDisplayName}
        isUpdatingStatus={isUpdatingStatus}
        onBack={() => router.back()}
        onBlockedStatusClick={handleBlockedTransitionClick}
        onStatusChange={handleStatusUpdate}
        status={data.deal.status}
        type={data.deal.type}
        transitionReadiness={data.workflow.transitionReadiness}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_1px_minmax(320px,1fr)]">
        <div className="space-y-6">
          <DealTabs
            activeTab={activeTab}
            badges={tabBadges}
            onTabChange={handleTabChange}
            overview={
              <DealOverviewTab
                calculation={data.calculation}
                commentValue={commentValue}
                deal={data.deal}
                isEditingComment={isEditingComment}
                isSavingComment={isSavingComment}
                legalEntity={data.legalEntity}
                onCancelEdit={handleCancelEditComment}
                onCommentChange={setCommentValue}
                onEditComment={handleEditComment}
                onSaveComment={handleSaveComment}
                organization={data.organization}
                organizationRequisite={data.organizationRequisite}
                organizationRequisiteProvider={data.organizationRequisiteProvider}
                requestedCurrency={data.requestedCurrency}
                workbench={data.workbench}
                workflow={data.workflow}
              />
            }
            intake={
              draftIntake ? (
                <DealIntakeTab
                  applicantRequisites={applicantRequisites}
                  currencyOptions={data.currencyOptions}
                  intake={draftIntake}
                  isDirty={isIntakeDirty}
                  isSaving={isSavingIntake}
                  legalEntities={data.customer.legalEntities}
                  onChange={setDraftIntake}
                  onReset={handleResetIntake}
                  onSave={handleSaveIntake}
                  readOnly={!data.workbench.editability.intake}
                  sectionCompleteness={data.workflow.sectionCompleteness}
                />
              ) : null
            }
            pricing={
              <DealPricingTab
                acceptedQuote={data.workbench.acceptedQuote}
                activeCalculationId={data.deal.calculationId}
                calculation={data.calculation}
                calculationDisabledReason={calculationDisabledReason}
                calculationHistory={data.calculationHistory}
                isAcceptingQuoteId={isAcceptingQuoteId}
                isCreatingCalculation={isCreatingCalculation}
                isCreatingQuote={isCreatingQuote}
                onAcceptQuote={handleAcceptQuote}
                onCreateCalculation={handleCreateCalculationFromAcceptedQuote}
                onCreateQuote={handleOpenQuoteDialog}
                quoteCreationDisabledReason={quoteCreationDisabledReason}
                quotes={data.workbench.pricing.quotes}
              />
            }
            documents={
              <DealDocumentsTab
                attachments={data.attachments}
                attachmentIngestions={data.workflow.attachmentIngestions}
                beneficiaryDraft={data.workbench.beneficiaryDraft}
                deletingAttachmentId={deletingAttachmentId}
                documentRequirements={data.workbench.documentRequirements}
                evidenceRequirements={data.workbench.evidenceRequirements}
                formalDocuments={data.formalDocuments}
                onAttachmentDelete={handleAttachmentDelete}
                onAttachmentDownload={handleAttachmentDownload}
                onAttachmentReingest={handleAttachmentReingest}
                onAttachmentUpload={handleOpenAttachmentDialog}
                reingestingAttachmentId={reingestingAttachmentId}
              />
            }
            execution={
              <DealExecutionTab
                executionPlan={data.workflow.executionPlan}
                isUpdatingLegKey={isUpdatingLegKey}
                onBlockedTransitionClick={handleBlockedTransitionClick}
                onUpdateLegState={handleLegStateUpdate}
                operationalState={data.workflow.operationalState}
                sectionCompleteness={data.workflow.sectionCompleteness}
                transitionReadiness={data.workflow.transitionReadiness}
              />
            }
          />
        </div>

        <div aria-hidden className="hidden self-stretch bg-border xl:block" />

        <div className="space-y-6">
          <DealManagementCard
            agreementId={data.agreement.id}
            agreementOptions={agreementOptions.map((agreement) => ({
              contractNumber: agreement.currentVersion.contractNumber,
              id: agreement.id,
              isActive: agreement.isActive,
              versionNumber: agreement.currentVersion.versionNumber,
            }))}
            assigneeUserId={data.workbench.assignee.userId}
            canChangeAgreement={data.workbench.editability.agreement}
            canReassignAssignee={data.workbench.editability.assignee}
            isUpdatingAgreement={isUpdatingAgreement}
            isUpdatingAssignee={isUpdatingAssignee}
            onAgreementChange={handleAgreementChange}
            onAssigneeChange={handleAssigneeChange}
          />
          <DealTimelineCard timeline={data.workflow.timeline} />
          <AgreementCard agreement={data.agreement} />
        </div>
      </div>

      <CalculationDialog
        asOf={calculationAsOf}
        amount={calculationAmount}
        currencyOptions={data.currencyOptions}
        description="Получите котировку для сделки. После этого ее можно принять и создать расчет."
        disabledReason={quoteCreationDisabledReason}
        isCreating={isCreatingQuote}
        onOpenChange={(open) => {
          setIsQuoteDialogOpen(open);
          if (!open) {
            setOverrideCalculationAmount(false);
          }
        }}
        onAmountChange={setCalculationAmount}
        onAsOfChange={setCalculationAsOf}
        onCancel={() => setIsQuoteDialogOpen(false)}
        onSubmit={handleCreateQuote}
        onToCurrencyChange={setCalculationToCurrency}
        onToggleOverride={setOverrideCalculationAmount}
        open={isQuoteDialogOpen}
        overrideAmount={overrideCalculationAmount}
        requestedCurrency={data.requestedCurrency}
        loadingLabel="Запрашиваем..."
        submitLabel="Запросить котировку"
        title="Запросить котировку"
        toCurrency={calculationToCurrency}
      />

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
