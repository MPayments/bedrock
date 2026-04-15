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
import { loadApplicantRequisites as loadApplicantRequisiteOptions } from "@/lib/applicant-requisites";
import { AgreementCard } from "./_components/agreement-card";
import { CalculationDialog } from "./_components/calculation-dialog";
import { CreateCalculationDialog } from "./_components/create-calculation-dialog";
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
  CrmCustomerCounterpartyOption,
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
  ApiCanonicalCounterparty,
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
  ApiCurrencyOption,
  ApiDealPricingQuote,
  ApiDealTransitionBlocker,
  ApiQuotePreview,
  DealLegState,
  DealStatus,
} from "./_components/types";

type DealPageData = {
  currency: ApiCurrency | null;
  currencyOptions: ApiCurrencyOption[];
  sourceCurrency: ApiCurrency | null;
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

function buildQuoteRequestContext(workbench: ApiCrmDealWorkbenchProjection) {
  if (workbench.summary.type === "payment") {
    return {
      amount: workbench.intake.incomingReceipt.expectedAmount,
      amountSide: "target" as const,
      sourceCurrencyId: workbench.intake.moneyRequest.sourceCurrencyId,
      targetCurrencyId: workbench.intake.moneyRequest.targetCurrencyId,
    };
  }

  return {
    amount: workbench.intake.moneyRequest.sourceAmount,
    amountSide: "source" as const,
    sourceCurrencyId: workbench.intake.moneyRequest.sourceCurrencyId,
    targetCurrencyId: workbench.intake.moneyRequest.targetCurrencyId,
  };
}

function normalizeDecimalString(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (!normalized || !/^\d+(?:\.\d+)?$/u.test(normalized)) {
    return null;
  }

  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw.replace(/0+$/u, "");

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function shiftDecimalString(value: string, decimalPlaces: number) {
  const normalized = normalizeDecimalString(value);

  if (!normalized) {
    return null;
  }

  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  const digits = `${wholeRaw}${fractionRaw}`.replace(/^0+(?=\d)/u, "") || "0";
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  if (nextScale <= 0) {
    return normalizeDecimalString(`${digits}${"0".repeat(-nextScale)}`);
  }

  if (nextScale >= digits.length) {
    return normalizeDecimalString(
      `0.${"0".repeat(nextScale - digits.length)}${digits}`,
    );
  }

  const integerPart = digits.slice(0, digits.length - nextScale);
  const fractionPart = digits.slice(digits.length - nextScale);

  return normalizeDecimalString(`${integerPart}.${fractionPart}`);
}

function buildCalculationFeeDefaults(input: {
  agreement: ApiAgreementDetails;
  fallbackCurrencyCode: string | null;
}) {
  let agreementFeePercentage = "";
  let fixedFeeAmount = "";
  let fixedFeeCurrencyCode = input.fallbackCurrencyCode;

  for (const rule of input.agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agreementFeePercentage = shiftDecimalString(rule.value, -2) ?? "";
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFeeAmount = normalizeDecimalString(rule.value) ?? "";
      fixedFeeCurrencyCode = rule.currencyCode ?? input.fallbackCurrencyCode;
    }
  }

  return {
    agreementFeePercentage,
    fixedFeeAmount,
    fixedFeeCurrencyCode,
  };
}

function formatCurrencyDisplayName(
  currencyOptions: ApiCurrencyOption[],
  code: string | null | undefined,
) {
  if (!code) {
    return "—";
  }

  const option = currencyOptions.find((item) => item.code === code);
  if (!option) {
    return code;
  }

  return `${option.name} (${option.code})`;
}

function formatQuoteDisplayPair(input: {
  amountSide: "source" | "target";
  currencyOptions: ApiCurrencyOption[];
  fromCurrency: string;
  toCurrency: string;
}) {
  if (input.amountSide === "target") {
    return `${formatCurrencyDisplayName(input.currencyOptions, input.toCurrency)} / ${formatCurrencyDisplayName(input.currencyOptions, input.fromCurrency)}`;
  }

  return `${formatCurrencyDisplayName(input.currencyOptions, input.fromCurrency)} / ${formatCurrencyDisplayName(input.currencyOptions, input.toCurrency)}`;
}

function formatQuoteDisplayRate(input: {
  amountSide: "source" | "target";
  currencyOptions: ApiCurrencyOption[];
  fromCurrency: string;
  rateDen: string;
  rateNum: string;
  toCurrency: string;
}) {
  if (input.amountSide === "target") {
    return `1 ${formatCurrencyDisplayName(input.currencyOptions, input.toCurrency)} = ${rationalToDecimalString(input.rateDen, input.rateNum)} ${formatCurrencyDisplayName(input.currencyOptions, input.fromCurrency)}`;
  }

  return `1 ${formatCurrencyDisplayName(input.currencyOptions, input.fromCurrency)} = ${rationalToDecimalString(input.rateNum, input.rateDen)} ${formatCurrencyDisplayName(input.currencyOptions, input.toCurrency)}`;
}

function findAcceptedQuoteDetails(
  workbench: ApiCrmDealWorkbenchProjection,
): ApiDealPricingQuote | null {
  const acceptedQuoteId = workbench.acceptedQuote?.quoteId;

  if (!acceptedQuoteId) {
    return null;
  }

  return workbench.pricing.quotes.find((quote) => quote.id === acceptedQuoteId) ?? null;
}

function mapCounterpartyOption(
  counterparty: ApiCanonicalCounterparty,
): CrmCustomerCounterpartyOption {
  const inn =
    counterparty.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === "inn",
    )?.value ??
    counterparty.externalRef ??
    null;

  return {
    counterpartyId: counterparty.id,
    fullName: counterparty.fullName,
    inn,
    orgName: counterparty.shortName,
    shortName: counterparty.shortName,
  };
}

function formatBlockers(blockers: ApiDealTransitionBlocker[]) {
  return blockers
    .map((blocker) => `• ${formatDealWorkflowMessage(blocker.message)}`)
    .join("\n");
}

type DealQuoteValidationError = {
  message: string;
  title: string;
};

type DealQuoteRequestBody = {
  asOf: string;
  fixedFeeAmount: string | null;
  fixedFeeCurrency: string | null;
  fromCurrency: string;
  fromAmountMinor?: string;
  mode: "auto_cross";
  quoteMarkupPercent: string | null;
  toAmountMinor?: string;
  toCurrency: string;
};

function prepareDealQuoteRequest(input: {
  calculationAmount: string;
  calculationAsOf: string;
  calculationToCurrency: string;
  currency: ApiCurrency | null;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  overrideCalculationAmount: boolean;
  quoteMarkupPercent: string;
  quoteRequest: ReturnType<typeof buildQuoteRequestContext> | null;
  sourceCurrency: ApiCurrency | null;
}): {
  body: DealQuoteRequestBody | null;
  validationError: DealQuoteValidationError | null;
} {
  const amountSource = input.overrideCalculationAmount
    ? input.calculationAmount
    : (input.quoteRequest?.amount ?? "");

  if (!input.sourceCurrency || !amountSource) {
    return {
      body: null,
      validationError: {
        message: "Для запроса котировки нужны сумма и валюта списания.",
        title: "Недостаточно данных",
      },
    };
  }

  if (!input.calculationToCurrency) {
    return {
      body: null,
      validationError: {
        message: "Выберите валюту назначения.",
        title: "Недостаточно данных",
      },
    };
  }

  if (input.calculationToCurrency === input.sourceCurrency.code) {
    return {
      body: null,
      validationError: {
        message: "Выберите другую валюту.",
        title: "Недопустимая валютная пара",
      },
    };
  }

  const amountMinor = decimalToMinorString(
    amountSource,
    input.quoteRequest?.amountSide === "target"
      ? (input.currency?.precision ?? input.sourceCurrency.precision)
      : input.sourceCurrency.precision,
  );

  if (!amountMinor || BigInt(amountMinor) <= 0n) {
    return {
      body: null,
      validationError: {
        message: "Введите сумму больше нуля в формате 1000.00.",
        title: "Некорректная сумма",
      },
    };
  }

  const asOfDate = input.calculationAsOf
    ? new Date(input.calculationAsOf)
    : new Date();

  if (Number.isNaN(asOfDate.getTime())) {
    return {
      body: null,
      validationError: {
        message: "Выберите дату котировки.",
        title: "Некорректная дата",
      },
    };
  }

  const normalizedFixedFeeAmount = input.fixedFeeAmount.trim()
    ? normalizeDecimalString(input.fixedFeeAmount)
    : null;

  if (input.fixedFeeAmount.trim() && !normalizedFixedFeeAmount) {
    return {
      body: null,
      validationError: {
        message: "Введите фиксированную комиссию в формате 25.00.",
        title: "Некорректная фиксированная комиссия",
      },
    };
  }

  if (normalizedFixedFeeAmount && !input.fixedFeeCurrencyCode) {
    return {
      body: null,
      validationError: {
        message: "Для фиксированной комиссии выберите валюту.",
        title: "Недостаточно данных",
      },
    };
  }

  return {
    body: {
      mode: "auto_cross",
      ...(input.quoteRequest?.amountSide === "target"
        ? { toAmountMinor: amountMinor }
        : { fromAmountMinor: amountMinor }),
      fromCurrency: input.sourceCurrency.code,
      toCurrency: input.calculationToCurrency,
      asOf: asOfDate.toISOString(),
      fixedFeeAmount: normalizedFixedFeeAmount,
      fixedFeeCurrency: normalizedFixedFeeAmount
        ? input.fixedFeeCurrencyCode
        : null,
      quoteMarkupPercent: input.quoteMarkupPercent.trim() || null,
    },
    validationError: null,
  };
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
  const [isCreateCalculationDialogOpen, setIsCreateCalculationDialogOpen] =
    useState(false);
  const [quoteMarkupPercent, setQuoteMarkupPercent] = useState("");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("");
  const [fixedFeeCurrencyCode, setFixedFeeCurrencyCode] = useState<
    string | null
  >(null);
  const [quotePreview, setQuotePreview] = useState<ApiQuotePreview | null>(
    null,
  );
  const [quotePreviewError, setQuotePreviewError] = useState<string | null>(
    null,
  );
  const [isQuotePreviewLoading, setIsQuotePreviewLoading] = useState(false);
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

  const acceptedQuoteDetails = useMemo(() => {
    if (!data) {
      return null;
    }

    return findAcceptedQuoteDetails(data.workbench);
  }, [data]);
  const agreementCommercialDefaults = useMemo(() => {
    if (!data || !data.workbench.context.agreement) {
      return {
        agreementFeePercentage: "",
        fixedFeeAmount: "",
        fixedFeeCurrencyCode: null,
      };
    }

    return buildCalculationFeeDefaults({
      agreement: data.workbench.context.agreement,
      fallbackCurrencyCode: calculationToCurrency || data.currency?.code || null,
    });
  }, [calculationToCurrency, data]);
  const acceptedQuoteCommercialSummary = useMemo(() => {
    if (!acceptedQuoteDetails) {
      return {
        agreementFeePercentage: "0",
        finalRate: "",
        fixedFeeAmount: "",
        fixedFeeCurrencyCode: null,
        quoteMarkupPercentage: "0",
        totalFeePercentage: "0",
      };
    }

    const quoteAmountSide = data
      ? buildQuoteRequestContext(data.workbench).amountSide
      : "source";

    return {
      agreementFeePercentage: feeBpsToPercentString(
        acceptedQuoteDetails.commercialTerms?.agreementFeeBps ?? "0",
      ),
      finalRate: formatQuoteDisplayRate({
        amountSide: quoteAmountSide,
        currencyOptions: data?.currencyOptions ?? [],
        fromCurrency: acceptedQuoteDetails.fromCurrency,
        rateDen: acceptedQuoteDetails.rateDen,
        rateNum: acceptedQuoteDetails.rateNum,
        toCurrency: acceptedQuoteDetails.toCurrency,
      }),
      fixedFeeAmount: acceptedQuoteDetails.commercialTerms?.fixedFeeAmountMinor
        ? minorToDecimalString(
            acceptedQuoteDetails.commercialTerms.fixedFeeAmountMinor,
            acceptedQuoteDetails.commercialTerms.fixedFeeCurrency
              ? (() => {
                  try {
                    return new Intl.NumberFormat("ru-RU", {
                      currency:
                        acceptedQuoteDetails.commercialTerms.fixedFeeCurrency,
                      style: "currency",
                    }).resolvedOptions().maximumFractionDigits ?? 2;
                  } catch {
                    return 2;
                  }
                })()
              : 2,
          )
        : "",
      fixedFeeCurrencyCode:
        acceptedQuoteDetails.commercialTerms?.fixedFeeCurrency ?? null,
      quoteMarkupPercentage: feeBpsToPercentString(
        acceptedQuoteDetails.commercialTerms?.quoteMarkupBps ?? "0",
      ),
      totalFeePercentage: feeBpsToPercentString(
        acceptedQuoteDetails.commercialTerms?.totalFeeBps ?? "0",
      ),
    };
  }, [acceptedQuoteDetails, data]);

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
      const quoteRequest = buildQuoteRequestContext(workbench);

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
      const applicantCounterpartyId =
        workbench.intake.common.applicantCounterpartyId ?? null;

      const [
        currency,
        sourceCurrency,
        currencyOptions,
        agreementsPayload,
        applicantRequisitesPayload,
      ] = await Promise.all([
        (workbench.summary.type === "payment"
          ? workbench.intake.moneyRequest.targetCurrencyId
          : workbench.intake.moneyRequest.sourceCurrencyId)
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${
                workbench.summary.type === "payment"
                  ? workbench.intake.moneyRequest.targetCurrencyId
                  : workbench.intake.moneyRequest.sourceCurrencyId
              }`,
            )
          : Promise.resolve(null),
        quoteRequest.sourceCurrencyId
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${quoteRequest.sourceCurrencyId}`,
            )
          : Promise.resolve(null),
        fetchCurrencyOptions(),
        customerId
          ? fetchJson<{ data: DealAgreementOption[] }>(
              `${API_BASE_URL}/agreements?customerId=${customerId}&limit=${MAX_QUERY_LIST_LIMIT}&offset=0`,
            )
          : Promise.resolve({ data: [] }),
        applicantCounterpartyId
          ? loadApplicantRequisiteOptions(applicantCounterpartyId)
          : Promise.resolve([]),
      ]);

      setData({
        currencyOptions,
        currency,
        sourceCurrency,
        workbench,
      });
      setAgreementOptions(agreementsPayload.data);
      setApplicantRequisites(applicantRequisitesPayload);
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

    const currentApplicantCounterpartyId = applicantCounterpartyId;

    let cancelled = false;

    async function loadApplicantRequisites() {
      try {
        const payload = await loadApplicantRequisiteOptions(
          currentApplicantCounterpartyId,
        );

        if (cancelled) {
          return;
        }

        setApplicantRequisites(payload);
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

    setCalculationAmount(buildQuoteRequestContext(data.workbench).amount ?? "");
  }, [data, overrideCalculationAmount]);

  useEffect(() => {
    if (!data || calculationToCurrency) {
      return;
    }

    const quoteRequest = buildQuoteRequestContext(data.workbench);
    setCalculationToCurrency(
      quoteRequest.amountSide === "target"
        ? (data.currency?.code ?? "")
        : resolveDefaultToCurrency(
            data.currencyOptions,
            data.sourceCurrency?.code ?? null,
          ),
    );
  }, [calculationToCurrency, data]);

  const handleOpenQuoteDialog = useCallback(() => {
    if (!data) {
      return;
    }

    setOverrideCalculationAmount(false);
    const quoteRequest = buildQuoteRequestContext(data.workbench);
    setCalculationAmount(quoteRequest.amount ?? "");
    setCalculationToCurrency(
      quoteRequest.amountSide === "target"
        ? (data.currency?.code ?? "")
        : resolveDefaultToCurrency(
            data.currencyOptions,
            data.sourceCurrency?.code ?? null,
          ),
    );
    setCalculationAsOf(formatDateTimeInput(new Date()));
    setQuoteMarkupPercent(
      acceptedQuoteDetails?.commercialTerms?.quoteMarkupBps
        ? feeBpsToPercentString(acceptedQuoteDetails.commercialTerms.quoteMarkupBps)
        : "",
    );
    setFixedFeeAmount(
      acceptedQuoteCommercialSummary.fixedFeeAmount ||
        agreementCommercialDefaults.fixedFeeAmount,
    );
    setFixedFeeCurrencyCode(
      acceptedQuoteCommercialSummary.fixedFeeCurrencyCode ??
        agreementCommercialDefaults.fixedFeeCurrencyCode,
    );
    setIsQuoteDialogOpen(true);
  }, [
    acceptedQuoteCommercialSummary.fixedFeeAmount,
    acceptedQuoteCommercialSummary.fixedFeeCurrencyCode,
    acceptedQuoteDetails,
    agreementCommercialDefaults.fixedFeeAmount,
    agreementCommercialDefaults.fixedFeeCurrencyCode,
    data,
  ]);

  const handleCreateQuote = useCallback(async () => {
    if (!data) {
      return;
    }

    const preparedQuoteRequest = prepareDealQuoteRequest({
      calculationAmount,
      calculationAsOf,
      calculationToCurrency,
      currency: data.currency,
      fixedFeeAmount,
      fixedFeeCurrencyCode,
      overrideCalculationAmount,
      quoteMarkupPercent,
      quoteRequest: buildQuoteRequestContext(data.workbench),
      sourceCurrency: data.sourceCurrency,
    });

    if (!preparedQuoteRequest.body) {
      showError(
        preparedQuoteRequest.validationError?.title ?? "Ошибка котировки",
        preparedQuoteRequest.validationError?.message ??
          "Не удалось подготовить запрос котировки.",
      );
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
          body: JSON.stringify(preparedQuoteRequest.body),
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
    fixedFeeAmount,
    fixedFeeCurrencyCode,
    loadDeal,
    overrideCalculationAmount,
    quoteMarkupPercent,
    showError,
  ]);

  const calculationTypeSupported = data
    ? data.workbench.pricing.quoteEligibility
    : false;
  const quoteStatusAllowed = data
    ? !["draft", "rejected", "done", "cancelled"].includes(
        data.workbench.summary.status,
      )
    : false;
  const quoteRequest = useMemo(
    () => (data ? buildQuoteRequestContext(data.workbench) : null),
    [data],
  );
  const quoteHasRequestedAmount = Boolean(
    quoteRequest?.amount &&
      quoteRequest.sourceCurrencyId &&
      (quoteRequest.amountSide === "source" || quoteRequest.targetCurrencyId),
  );
  const isIntakeDirty = !areIntakeDraftsEqual(draftIntake, baselineIntake);
  const quoteCreationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : !calculationTypeSupported
      ? "Котировка доступна только для сделок с обменом валют."
      : !quoteStatusAllowed
        ? `Нельзя запросить котировку для статуса "${STATUS_LABELS[data.workbench.summary.status]}".`
        : !quoteHasRequestedAmount
          ? "У сделки нет суммы или валют для запроса котировки."
          : null;
  const quotePreviewRequest = useMemo(
    () =>
      prepareDealQuoteRequest({
        calculationAmount,
        calculationAsOf,
        calculationToCurrency,
        currency: data?.currency ?? null,
        fixedFeeAmount,
        fixedFeeCurrencyCode,
        overrideCalculationAmount,
        quoteMarkupPercent,
        quoteRequest,
        sourceCurrency: data?.sourceCurrency ?? null,
      }),
    [
      calculationAmount,
      calculationAsOf,
      calculationToCurrency,
      data?.currency,
      data?.sourceCurrency,
      fixedFeeAmount,
      fixedFeeCurrencyCode,
      overrideCalculationAmount,
      quoteMarkupPercent,
      quoteRequest,
    ],
  );
  const calculationDisabledReason = !data
    ? "Данные сделки еще загружаются."
    : quoteCreationDisabledReason
      ? quoteCreationDisabledReason
      : !data.workbench.acceptedQuote
        ? "Сначала примите котировку."
        : data.workbench.acceptedQuote.quoteStatus !== "active"
          ? "Создать расчет можно только по действующей принятой котировке."
          : null;

  useEffect(() => {
    if (!isQuoteDialogOpen) {
      setQuotePreview(null);
      setQuotePreviewError(null);
      setIsQuotePreviewLoading(false);
      return;
    }

    if (quoteCreationDisabledReason) {
      setQuotePreview(null);
      setQuotePreviewError(quoteCreationDisabledReason);
      setIsQuotePreviewLoading(false);
      return;
    }

    if (!quotePreviewRequest.body) {
      setQuotePreview(null);
      setQuotePreviewError(quotePreviewRequest.validationError?.message ?? null);
      setIsQuotePreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const preview = await fetchJson<ApiQuotePreview>(
          `${API_BASE_URL}/deals/${dealId}/quotes/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(quotePreviewRequest.body),
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setQuotePreview(preview);
          setQuotePreviewError(null);
        });
      } catch (nextError) {
        if (
          controller.signal.aborted ||
          (nextError instanceof DOMException &&
            nextError.name === "AbortError")
        ) {
          return;
        }

        startTransition(() => {
          setQuotePreview(null);
          setQuotePreviewError(
            nextError instanceof Error
              ? nextError.message
              : "Не удалось получить предварительную котировку.",
          );
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsQuotePreviewLoading(false);
        }
      }
    }, 250);

    setIsQuotePreviewLoading(true);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    dealId,
    isQuoteDialogOpen,
    quoteCreationDisabledReason,
    quotePreviewRequest,
  ]);

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

  const handleOpenCreateCalculationDialog = useCallback(() => {
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

    setIsCreateCalculationDialogOpen(true);
  }, [data, showError]);

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

      setIsCreateCalculationDialogOpen(false);
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
        isWarning ? "Нужно заполнить анкету" : "Переход заблокирован",
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

  const handleSaveIntake = useCallback(async () => {
    if (!data || !draftIntake) {
      return;
    }

    try {
      setIsSavingIntake(true);

      const response = await fetch(`${API_BASE_URL}/deals/${dealId}/intake`, {
        body: JSON.stringify({
          expectedRevision: data.workbench.revision,
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

  const tabBadges = useMemo(() => {
    if (!data) {
      return {};
    }

    const incompleteSectionCount = data.workbench.sectionCompleteness.filter(
      (section) => !section.complete,
    ).length;
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
      documents: missingEvidenceCount + missingDocumentCount,
      execution: blockedLegCount + blockedPositionCount,
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

  const agreement = data.workbench.context.agreement;
  const customerContext = data.workbench.context.customer;

  if (!agreement || !customerContext) {
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
            intake={
              draftIntake ? (
                <DealIntakeTab
                  applicantRequisites={applicantRequisites}
                  currencyOptions={data.currencyOptions}
                  intake={draftIntake}
                  isDirty={isIntakeDirty}
                  isSaving={isSavingIntake}
                  counterparties={customerContext.counterparties.map(
                    mapCounterpartyOption,
                  )}
                  onChange={setDraftIntake}
                  onReset={handleResetIntake}
                  onSave={handleSaveIntake}
                  readOnly={!data.workbench.editability.intake}
                  sectionCompleteness={data.workbench.sectionCompleteness}
                />
              ) : null
            }
            pricing={
              <DealPricingTab
                calculationDisabledReason={calculationDisabledReason}
                isAcceptingQuoteId={isAcceptingQuoteId}
                isCreatingCalculation={isCreatingCalculation}
                isCreatingQuote={isCreatingQuote}
                onAcceptQuote={handleAcceptQuote}
                onCreateCalculation={handleOpenCreateCalculationDialog}
                onCreateQuote={handleOpenQuoteDialog}
                quoteAmountSide={quoteRequest?.amountSide ?? "source"}
                quoteCreationDisabledReason={quoteCreationDisabledReason}
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

      <CalculationDialog
        agreementFeePercentage={agreementCommercialDefaults.agreementFeePercentage}
        asOf={calculationAsOf}
        amount={calculationAmount}
        amountSide={quoteRequest?.amountSide ?? "source"}
        currencyOptions={data.currencyOptions}
        description="Получите котировку для сделки. После этого ее можно принять и создать расчет."
        disabledReason={quoteCreationDisabledReason}
        fixedFeeAmount={fixedFeeAmount}
        fixedFeeCurrencyCode={fixedFeeCurrencyCode}
        isCreating={isCreatingQuote}
        isPreviewLoading={isQuotePreviewLoading}
        onOpenChange={(open) => {
          setIsQuoteDialogOpen(open);
          if (!open) {
            setOverrideCalculationAmount(false);
          }
        }}
        onAmountChange={setCalculationAmount}
        onAsOfChange={setCalculationAsOf}
        onCancel={() => setIsQuoteDialogOpen(false)}
        onFixedFeeAmountChange={setFixedFeeAmount}
        onFixedFeeCurrencyChange={(value) =>
          setFixedFeeCurrencyCode(value || null)
        }
        onQuoteMarkupPercentChange={setQuoteMarkupPercent}
        onSubmit={handleCreateQuote}
        onToCurrencyChange={setCalculationToCurrency}
        onToggleOverride={setOverrideCalculationAmount}
        open={isQuoteDialogOpen}
        overrideAmount={overrideCalculationAmount}
        preview={quotePreview}
        previewError={quotePreviewError}
        quoteMarkupPercent={quoteMarkupPercent}
        sourceCurrency={data.sourceCurrency}
        loadingLabel="Запрашиваем..."
        submitLabel="Запросить котировку"
        title="Запросить котировку"
        toCurrency={calculationToCurrency}
      />

      <CreateCalculationDialog
        agreementFeePercentage={
          acceptedQuoteCommercialSummary.agreementFeePercentage
        }
        finalRate={acceptedQuoteCommercialSummary.finalRate}
        fixedFeeAmount={acceptedQuoteCommercialSummary.fixedFeeAmount}
        fixedFeeCurrencyCode={acceptedQuoteCommercialSummary.fixedFeeCurrencyCode}
        isCreating={isCreatingCalculation}
        onCancel={() => setIsCreateCalculationDialogOpen(false)}
        onOpenChange={setIsCreateCalculationDialogOpen}
        onSubmit={handleCreateCalculationFromAcceptedQuote}
        open={isCreateCalculationDialogOpen}
        quotePairLabel={
          acceptedQuoteDetails
            ? formatQuoteDisplayPair({
                amountSide: quoteRequest?.amountSide ?? "source",
                currencyOptions: data.currencyOptions,
                fromCurrency: acceptedQuoteDetails.fromCurrency,
                toCurrency: acceptedQuoteDetails.toCurrency,
              })
            : null
        }
        quoteMarkupPercentage={
          acceptedQuoteCommercialSummary.quoteMarkupPercentage
        }
        totalFeePercentage={acceptedQuoteCommercialSummary.totalFeePercentage}
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
