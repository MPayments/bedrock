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

import { formatCompactId } from "@bedrock/shared/core/uuid";
import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { API_BASE_URL } from "@/lib/constants";
import { loadApplicantRequisites as loadApplicantRequisiteOptions } from "@/lib/applicant-requisites";
import { CalculationDialog } from "./_components/calculation-dialog";
import { CreateCalculationDialog } from "./_components/create-calculation-dialog";
import { ApprovalPane } from "./_components/approval-pane";
import { CalculatingPane } from "./_components/calculating-pane";
import { FundingPane } from "./_components/funding-pane";
import { PricingPane } from "./_components/pricing-pane";
import { SettledPane } from "./_components/settled-pane";
import { KeyDatesSidebarCard } from "./_components/key-dates-sidebar-card";
import { PartiesSidebarCard } from "./_components/parties-sidebar-card";
import {
  DEFAULT_DEAL_PAGE_TAB,
  isDealPageTab,
  type DealPageTab,
} from "./_components/deal-tabs";
import {
  DealStageTrack,
  DEAL_STAGE_ORDER,
  StageViewingBanner,
  currentStageIndexFromStatus,
  type DealStageKey,
} from "./_components/deal-stage-track";
import { DealHeader } from "./_components/deal-header";
import { ErrorDialog } from "./_components/error-dialog";
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
  ApiCanonicalCounterparty,
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
  ApiCurrencyOption,
  ApiDealCustomerContext,
  ApiCustomerCounterparty,
  ApiCustomerWorkspace,
  ApiDealDetails,
  ApiDealPricingQuote,
  ApiDealTransitionBlocker,
  ApiDealWorkflowProjection,
  ApiFormalDocument,
  ApiOrganization,
  ApiQuotePreview,
  ApiRequisite,
  ApiRequisiteProvider,
  CalculationHistoryView,
  CalculationView,
  DealStatus,
} from "./_components/types";

const STAGE_TO_TAB: Record<DealStageKey, DealPageTab> = {
  pricing: "intake",
  calculating: "pricing",
  approval: "documents",
  funding: "execution",
  settled: "overview",
};

const TAB_TO_STAGE: Record<DealPageTab, DealStageKey> = {
  intake: "pricing",
  pricing: "calculating",
  documents: "approval",
  execution: "funding",
  overview: "settled",
};

type DealPageData = {
  agreement: ApiAgreementDetails;
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  calculationHistory: CalculationHistoryView[];
  customer: ApiCustomerWorkspace;
  deal: ApiDealDetails;
  formalDocuments: ApiFormalDocument[];
  partyProfile: ApiCustomerCounterparty | null;
  organization: ApiOrganization;
  organizationRequisite: ApiRequisite;
  organizationRequisiteProvider: ApiRequisiteProvider | null;
  currency: ApiCurrency | null;
  sourceCurrency: ApiCurrency | null;
  workbench: ApiCrmDealWorkbenchProjection;
  workflow: ApiDealWorkflowProjection;
  currencyOptions: ApiCurrencyOption[];
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
    amount:
      workbench.summary.type === "payment"
        ? workbench.intake.incomingReceipt.expectedAmount
        : workbench.intake.moneyRequest.sourceAmount,
    agentId: workbench.summary.agentId,
    approvals: workbench.approvals,
    calculationId: workbench.summary.calculationId,
    comment: workbench.comment,
    currencyId:
      workbench.summary.type === "payment"
        ? workbench.intake.moneyRequest.targetCurrencyId
        : workbench.intake.moneyRequest.sourceCurrencyId,
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

function pickPrimary<T extends { isPrimary: boolean }>(items: T[]) {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

function findCounterpartyIdentifier(
  counterparty: ApiCanonicalCounterparty,
  scheme: string,
) {
  return (
    counterparty.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === scheme,
    )?.value ?? null
  );
}

function findCounterpartyContact(
  counterparty: ApiCanonicalCounterparty,
  type: string,
) {
  return (
    pickPrimary(
      (counterparty.partyProfile?.contacts ?? []).filter(
        (contact) => contact.type === type,
      ),
    )?.value ?? null
  );
}

function findCounterpartyRepresentative(
  counterparty: ApiCanonicalCounterparty,
  roles: string[] = ["director", "signatory", "contact"],
) {
  for (const role of roles) {
    const representative = pickPrimary(
      (counterparty.partyProfile?.representatives ?? []).filter(
        (item) => item.role === role,
      ),
    );

    if (representative) {
      return representative;
    }
  }

  return pickPrimary(counterparty.partyProfile?.representatives ?? []);
}

function mapCustomerCounterparty(
  counterparty: ApiCanonicalCounterparty,
): ApiCustomerCounterparty {
  const representative = findCounterpartyRepresentative(counterparty);

  return {
    counterpartyId: counterparty.id,
    directorBasis: representative?.basisDocument ?? null,
    directorName: representative?.fullName ?? null,
    email: findCounterpartyContact(counterparty, "email"),
    fullName: counterparty.fullName,
    inn:
      findCounterpartyIdentifier(counterparty, "inn") ??
      counterparty.externalRef ??
      null,
    kpp: findCounterpartyIdentifier(counterparty, "kpp"),
    orgName: counterparty.shortName,
    phone: findCounterpartyContact(counterparty, "phone"),
    position: representative?.title ?? null,
    relationshipKind: counterparty.relationshipKind,
    shortName: counterparty.shortName,
  };
}

function mapCustomerWorkspace(
  context: ApiDealCustomerContext,
): ApiCustomerWorkspace {
  return {
    description: context.customer.description,
    name: context.customer.name,
    externalRef: context.customer.externalRef,
    id: context.customer.id,
    counterparties: context.counterparties.map(mapCustomerCounterparty),
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

async function fetchCalculationViewFromDetails(
  calculation: ApiCalculationDetails,
): Promise<CalculationView> {
  const currencyIds = [
    calculation.currentSnapshot.fixedFeeCurrencyId,
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
  const fixedFeeCurrency = calculation.currentSnapshot.fixedFeeCurrencyId
    ? (currenciesById.get(calculation.currentSnapshot.fixedFeeCurrencyId) ?? null)
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
    agreementFeeAmount: minorToDecimalString(
      calculation.currentSnapshot.agreementFeeAmountMinor,
      calculationCurrency.precision,
    ),
    agreementFeePercentage: feeBpsToPercentString(
      calculation.currentSnapshot.agreementFeeBps,
    ),
    baseCurrencyCode: baseCurrency.code,
    currencyCode: calculationCurrency.code,
    finalRate: rationalToDecimalString(
      calculation.currentSnapshot.rateNum,
      calculation.currentSnapshot.rateDen,
    ),
    fixedFeeAmount: minorToDecimalString(
      calculation.currentSnapshot.fixedFeeAmountMinor,
      fixedFeeCurrency?.precision ?? baseCurrency.precision,
    ),
    fixedFeeCurrencyCode: fixedFeeCurrency?.code ?? null,
    originalAmount: minorToDecimalString(
      calculation.currentSnapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupAmount: minorToDecimalString(
      calculation.currentSnapshot.quoteMarkupAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(
      calculation.currentSnapshot.quoteMarkupBps,
    ),
    totalFeeAmount: minorToDecimalString(
      calculation.currentSnapshot.totalFeeAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeeAmountInBase: minorToDecimalString(
      calculation.currentSnapshot.totalFeeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    totalFeePercentage: feeBpsToPercentString(
      calculation.currentSnapshot.totalFeeBps,
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
  const [draftIntake, setDraftIntake] = useState<CrmDealIntakeDraft | null>(
    null,
  );
  const [baselineIntake, setBaselineIntake] =
    useState<CrmDealIntakeDraft | null>(null);
  const [applicantRequisites, setApplicantRequisites] = useState<
    CrmApplicantRequisiteOption[]
  >([]);
  const [isSavingIntake, setIsSavingIntake] = useState(false);
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

  const explicitTab = useMemo<DealPageTab | null>(() => {
    const tabParam = searchParams.get("tab");
    return isDealPageTab(tabParam) ? tabParam : null;
  }, [searchParams]);

  const viewStage = useMemo<DealStageKey>(() => {
    if (explicitTab) return TAB_TO_STAGE[explicitTab];
    if (data)
      return (
        DEAL_STAGE_ORDER[currentStageIndexFromStatus(data.deal.status)] ??
        "pricing"
      );
    return "pricing";
  }, [data, explicitTab]);

  const acceptedQuoteDetails = useMemo(() => {
    if (!data) {
      return null;
    }

    return findAcceptedQuoteDetails(data.workbench);
  }, [data]);
  const agreementCommercialDefaults = useMemo(() => {
    if (!data) {
      return {
        agreementFeePercentage: "",
        fixedFeeAmount: "",
        fixedFeeCurrencyCode: null,
      };
    }

    return buildCalculationFeeDefaults({
      agreement: data.agreement,
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

  const handleStageChange = useCallback(
    (stage: DealStageKey) => {
      handleTabChange(STAGE_TO_TAB[stage]);
    },
    [handleTabChange],
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
      const quoteRequest = buildQuoteRequestContext(workbench);

      if (
        !workbench.context.agreement ||
        !workbench.context.customer ||
        !workbench.context.internalEntity ||
        !workbench.context.internalEntityRequisite
      ) {
        throw new Error("Не удалось собрать контекст сделки для CRM.");
      }

      const applicantCounterpartyId =
        workbench.intake.common.applicantCounterpartyId ?? null;

      const [
        currency,
        sourceCurrency,
        calculation,
        currencyOptions,
        applicantRequisitesPayload,
      ] = await Promise.all([
        deal.currencyId
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${deal.currencyId}`,
            )
          : Promise.resolve(null),
        quoteRequest.sourceCurrencyId
          ? fetchJson<ApiCurrency>(
              `${API_BASE_URL}/currencies/${quoteRequest.sourceCurrencyId}`,
            )
          : Promise.resolve(null),
        workbench.pricing.currentCalculation
          ? fetchCalculationViewFromDetails(
              workbench.pricing.currentCalculation,
            )
          : Promise.resolve(null),
        fetchCurrencyOptions(),
        applicantCounterpartyId
          ? loadApplicantRequisiteOptions(applicantCounterpartyId)
          : Promise.resolve([]),
      ]);

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
        customer: mapCustomerWorkspace(workbench.context.customer),
        deal,
        formalDocuments: mapRelatedDocumentsToFormalDocuments(
          workbench.relatedResources.formalDocuments,
          workbench.summary.createdAt,
        ),
        partyProfile: workbench.context.applicant
          ? mapCustomerCounterparty(workbench.context.applicant)
          : null,
        organization: workbench.context.internalEntity,
        organizationRequisite: workbench.context.internalEntityRequisite,
        organizationRequisiteProvider:
          workbench.context.internalEntityRequisiteProvider,
        currency,
        sourceCurrency,
        workbench,
        workflow: workbench.workflow,
      });
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
    ? !["draft", "rejected", "done", "cancelled"].includes(data.deal.status)
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
        ? `Нельзя запросить котировку для статуса "${STATUS_LABELS[data.deal.status]}".`
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

  const currentStage: DealStageKey =
    DEAL_STAGE_ORDER[currentStageIndexFromStatus(data.deal.status)] ??
    "pricing";

  const currencyPairLabel = (() => {
    const src = data.sourceCurrency?.code;
    const tgt = data.currency?.code;
    if (src && tgt && src !== tgt) return `${src} → ${tgt}`;
    if (tgt) return tgt;
    if (src) return src;
    return null;
  })();

  const corridorLabel = (() => {
    const fromCountry =
      data.workbench.intake.incomingReceipt.payerSnapshot?.country ??
      null;
    const toCountry =
      data.workbench.intake.externalBeneficiary.beneficiarySnapshot?.country ??
      data.workbench.beneficiaryDraft?.beneficiarySnapshot?.country ??
      null;
    if (fromCountry && toCountry && fromCountry !== toCountry) {
      return `${fromCountry} → ${toCountry}`;
    }
    if (toCountry) return toCountry;
    return null;
  })();

  const dueDateLabel = (() => {
    const iso = data.workbench.intake.common.requestedExecutionDate;
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return `Срок: ${new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
      }).format(d)}`;
    } catch {
      return null;
    }
  })();

  const beneficiaryDisplayName =
    data.partyProfile?.fullName ||
    data.partyProfile?.shortName ||
    null;

  const netMarginInBase = data.calculation
    ? (() => {
        const fee = Number(
          (data.calculation.totalFeeAmountInBase ?? "0").replace(",", "."),
        );
        const expenses = Number(
          (data.calculation.additionalExpensesInBase ?? "0").replace(",", "."),
        );
        if (!Number.isFinite(fee) || !Number.isFinite(expenses)) return null;
        return fee - expenses;
      })()
    : null;

  const closedAtIso =
    data.deal.status === "done" || data.deal.status === "cancelled"
      ? data.deal.updatedAt
      : null;

  const plannedNetMarginInBase = (() => {
    const first = data.workbench.pricing.calculationHistory[0];
    if (!first?.totalFeeAmountMinor) return null;
    const raw = Number(first.totalFeeAmountMinor);
    if (!Number.isFinite(raw)) return null;
    return raw / 100;
  })();

  const isReadOnlyView = viewStage !== currentStage;

  const handleOpenContract = () =>
    toast.info("Открытие договора появится в следующей итерации");
  const handleSendToCustomer = () =>
    toast.info("Отправка клиенту появится в следующей итерации");
  const handleSendCalcPdf = () =>
    toast.info("Выгрузка PDF подключится в следующей итерации");
  const handleDownloadPack = () =>
    toast.info("Пакет документов появится в следующей итерации");
  const handleSendStatement = () =>
    toast.info("Отправка стейтмента подключится в следующей итерации");
  const handleNudgeApprover = () =>
    toast.success("Напоминание отправлено аппрувверу");

  const stagePanes: Record<DealStageKey, React.ReactNode> = {
    pricing: (
      <PricingPane
        acceptedQuote={data.workbench.acceptedQuote}
        acceptingQuoteId={isAcceptingQuoteId}
        calculation={data.calculation}
        currencyOptions={data.currencyOptions}
        intake={data.workbench.intake}
        intakeProps={
          draftIntake
            ? {
                applicantRequisites,
                currencyOptions: data.currencyOptions,
                intake: draftIntake,
                isDirty: isIntakeDirty,
                isSaving: isSavingIntake,
                counterparties: data.customer.counterparties,
                onChange: setDraftIntake,
                onReset: handleResetIntake,
                onSave: handleSaveIntake,
                readOnly: !data.workbench.editability.intake,
                sectionCompleteness: data.workflow.sectionCompleteness,
              }
            : null
        }
        onAcceptQuote={handleAcceptQuote}
        onOpenQuoteDialog={handleOpenQuoteDialog}
        onSendToCustomer={handleSendToCustomer}
        quotes={data.workbench.pricing.quotes}
        readOnly={isReadOnlyView}
        timeline={data.workflow.timeline}
      />
    ),
    calculating: (
      <CalculatingPane
        acceptedQuote={data.workbench.acceptedQuote}
        calculation={data.calculation}
        calculationAmount={calculationAmount}
        currencyOptions={data.currencyOptions}
        fixedFeeAmount={fixedFeeAmount}
        fixedFeeCurrencyCode={fixedFeeCurrencyCode}
        intake={data.workbench.intake}
        isCreatingCalculation={isCreatingCalculation}
        isCreatingQuote={isCreatingQuote}
        isUpdatingStatus={isUpdatingStatus}
        netMarginInBase={netMarginInBase}
        onAmountChange={setCalculationAmount}
        onCreateCalculation={handleOpenCreateCalculationDialog}
        onCreateQuote={handleCreateQuote}
        onEditInputs={handleOpenQuoteDialog}
        onFixedFeeAmountChange={setFixedFeeAmount}
        onFixedFeeCurrencyChange={(value) =>
          setFixedFeeCurrencyCode(value || null)
        }
        onQuoteMarkupPercentChange={setQuoteMarkupPercent}
        onSendCalcPdf={handleSendCalcPdf}
        onSendToCustomer={handleSendToCustomer}
        onStatusChange={handleStatusUpdate}
        onToCurrencyChange={setCalculationToCurrency}
        quoteMarkupPercent={quoteMarkupPercent}
        quotes={data.workbench.pricing.quotes}
        readOnly={isReadOnlyView}
        toCurrency={calculationToCurrency}
      />
    ),
    approval: (
      <ApprovalPane
        approvals={data.workbench.approvals}
        calculation={data.calculation}
        documentRequirements={data.workbench.documentRequirements}
        isUpdatingStatus={isUpdatingStatus}
        netMarginInBase={netMarginInBase}
        onNudgeApprover={handleNudgeApprover}
        onStatusChange={handleStatusUpdate}
        readOnly={isReadOnlyView}
        transitionReadiness={data.workflow.transitionReadiness}
      />
    ),
    funding: (
      <FundingPane
        calculation={data.calculation}
        executionPlan={data.workbench.executionPlan}
        netMarginInBase={netMarginInBase}
        operationalState={data.workflow.operationalState}
        readOnly={isReadOnlyView}
      />
    ),
    settled: (
      <SettledPane
        attachments={data.attachments}
        calculation={data.calculation}
        closedAt={closedAtIso}
        createdAt={data.deal.createdAt}
        formalDocuments={data.formalDocuments}
        netMarginInBase={netMarginInBase}
        onDownloadPack={handleDownloadPack}
        onSendStatement={handleSendStatement}
        plannedNetMarginInBase={plannedNetMarginInBase}
        reason={data.deal.reason}
        status={data.deal.status}
      />
    ),
  };

  return (
    <div className="space-y-5">
      <DealHeader
        applicantDisplayName={data.workbench.summary.applicantDisplayName}
        beneficiaryDisplayName={beneficiaryDisplayName}
        corridorLabel={corridorLabel}
        currencyPairLabel={currencyPairLabel}
        dealCompactId={formatCompactId(data.deal.id)}
        dueDateLabel={dueDateLabel}
        isUpdatingStatus={isUpdatingStatus}
        onApproveFunding={() => handleStatusUpdate("awaiting_funds")}
        onBack={() => router.back()}
        onBlockedStatusClick={handleBlockedTransitionClick}
        onOpenCalculation={() => handleStageChange("calculating")}
        onOpenContract={handleOpenContract}
        onStatusChange={handleStatusUpdate}
        readOnly={viewStage !== currentStage}
        status={data.deal.status}
        type={data.deal.type}
        transitionReadiness={data.workflow.transitionReadiness}
      />

      <DealStageTrack
        status={data.deal.status}
        viewStage={viewStage}
        onViewStageChange={handleStageChange}
      />

      <StageViewingBanner
        viewStage={viewStage}
        currentStage={currentStage}
        onJumpToCurrent={() => handleStageChange(currentStage)}
      />

      <div className="detail-grid">
        <div className="detail-main">{stagePanes[viewStage]}</div>

        <div className="detail-side">
          <PartiesSidebarCard
            applicant={data.workbench.context.applicant}
            assignee={data.workbench.assignee}
            beneficiarySnapshot={
              data.workbench.intake.externalBeneficiary.beneficiarySnapshot ??
              data.workbench.beneficiaryDraft?.beneficiarySnapshot ??
              null
            }
            customer={data.workbench.context.customer}
            customerDisplayName={data.workbench.summary.customerDisplayName}
          />
          <KeyDatesSidebarCard timeline={data.workflow.timeline} />
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
