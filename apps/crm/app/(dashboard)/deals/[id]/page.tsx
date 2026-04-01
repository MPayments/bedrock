"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Download,
  Edit,
  File,
  FileImage,
  FileText,
  FileType,
  Landmark,
  PackageOpen,
  Paperclip,
  Save,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import {
  DropdownMenuGroup,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { getUuidPrefix } from "@bedrock/shared/core/uuid";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { API_BASE_URL } from "@/lib/constants";
import {
  formatAgreementFeeRuleLabel,
  type AgreementFeeRuleView,
} from "@/lib/utils/agreement-fee-format";

type DealStatus =
  | "draft"
  | "submitted"
  | "rejected"
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

type DealType =
  | "payment"
  | "currency_exchange"
  | "currency_transit"
  | "exporter_settlement";

type ApiDealParticipant = {
  counterpartyId: string | null;
  customerId: string | null;
  id: string;
  organizationId: string | null;
  partyId: string;
  role: "customer" | "organization" | "counterparty";
};

type ApiDealStatusHistory = {
  changedBy: string | null;
  comment: string | null;
  createdAt: string;
  id: string;
  status: DealStatus;
};

type ApiDealDetails = {
  agreementId: string;
  agentId: string | null;
  approvals: {
    approvalType: string;
    comment: string | null;
    decidedAt: string | null;
    decidedBy: string | null;
    id: string;
    requestedAt: string;
    requestedBy: string | null;
    status: string;
  }[];
  calculationId: string | null;
  comment: string | null;
  createdAt: string;
  customerId: string;
  id: string;
  intakeComment: string | null;
  participants: ApiDealParticipant[];
  reason: string | null;
  requestedAmount: string | null;
  requestedCurrencyId: string | null;
  status: DealStatus;
  statusHistory: ApiDealStatusHistory[];
  type: DealType;
  updatedAt: string;
};

type ApiCalculationDetails = {
  createdAt: string;
  currentSnapshot: {
    additionalExpensesAmountMinor: string;
    additionalExpensesCurrencyId: string | null;
    additionalExpensesInBaseMinor: string;
    baseCurrencyId: string;
    calculationCurrencyId: string;
    calculationTimestamp: string;
    feeAmountInBaseMinor: string;
    feeAmountMinor: string;
    feeBps: string;
    rateDen: string;
    rateNum: string;
    originalAmountMinor: string;
    totalAmountMinor: string;
    totalInBaseMinor: string;
    totalWithExpensesInBaseMinor: string;
  };
  id: string;
  isActive: boolean;
  updatedAt: string;
};

type ApiCurrency = {
  code: string;
  id: string;
  precision: number;
};

type ApiAgreementFeeRule = AgreementFeeRuleView & {
  id: string;
};

type ApiAgreementDetails = {
  currentVersion: {
    contractDate: string | null;
    contractNumber: string | null;
    feeRules: ApiAgreementFeeRule[];
    id: string;
    versionNumber: number;
  };
  id: string;
  isActive: boolean;
  organizationId: string;
  organizationRequisiteId: string;
};

type ApiCustomerLegalEntity = {
  account: string | null;
  beneficiaryName: string | null;
  bic: string | null;
  corrAccount: string | null;
  counterpartyId: string;
  directorBasis: string | null;
  directorName: string | null;
  email: string | null;
  fullName: string;
  iban: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  orgName: string;
  phone: string | null;
  position: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  subAgent: {
    commissionRate: number;
    counterpartyId: string;
    fullName: string;
    kind: "individual" | "legal_entity";
    shortName: string;
  } | null;
  swift: string | null;
};

type ApiCustomerWorkspace = {
  description: string | null;
  displayName: string;
  externalRef: string | null;
  id: string;
  legalEntities: ApiCustomerLegalEntity[];
};

type ApiOrganization = {
  address: string | null;
  directorBasis: string | null;
  directorName: string | null;
  directorPosition: string | null;
  fullName: string;
  id: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  shortName: string;
};

type ApiRequisite = {
  accountNo: string | null;
  beneficiaryName: string | null;
  corrAccount: string | null;
  currencyId: string;
  iban: string | null;
  id: string;
  label: string;
  providerId: string;
};

type ApiRequisiteProvider = {
  address: string | null;
  bic: string | null;
  country: string | null;
  id: string;
  name: string;
  swift: string | null;
};

type ApiAttachment = {
  createdAt: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  updatedAt: string;
  uploadedBy: string | null;
};

type ApiFormalDocument = {
  amount: string | null;
  approvalStatus: string;
  createdAt: string;
  currency: string | null;
  docType: string;
  id: string;
  lifecycleStatus: string;
  postingStatus: string;
  submissionStatus: string;
  title: string | null;
};

type CalculationView = {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  baseCurrencyCode: string;
  currencyCode: string;
  feeAmount: string;
  feeAmountInBase: string;
  feePercentage: string;
  originalAmount: string;
  rate: string;
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
};

type DealPageData = {
  agreement: ApiAgreementDetails;
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  customer: ApiCustomerWorkspace;
  deal: ApiDealDetails;
  formalDocuments: ApiFormalDocument[];
  legalEntity: ApiCustomerLegalEntity | null;
  organization: ApiOrganization;
  organizationRequisite: ApiRequisite;
  organizationRequisiteProvider: ApiRequisiteProvider | null;
  requestedCurrencyCode: string | null;
};

const STATUS_LABELS: Record<DealStatus, string> = {
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  cancelled: "Отменена",
  closing_documents: "Закрывающие документы",
  done: "Завершена",
  draft: "Черновик",
  preparing_documents: "Подготовка документов",
  rejected: "Отклонена",
  submitted: "Отправлена",
};

const STATUS_COLORS: Record<DealStatus, string> = {
  awaiting_funds: "bg-orange-100 text-orange-800",
  awaiting_payment: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  closing_documents: "bg-cyan-100 text-cyan-800",
  done: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-800",
  preparing_documents: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800",
  submitted: "bg-sky-100 text-sky-800",
};

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  currency_exchange: "Конверсия",
  currency_transit: "Транзит",
  exporter_settlement: "Расчеты экспортера",
  payment: "Платеж",
};

const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  awaiting_funds: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["closing_documents", "cancelled"],
  cancelled: [],
  closing_documents: ["done", "cancelled"],
  done: [],
  draft: ["submitted", "rejected", "cancelled"],
  preparing_documents: ["awaiting_funds", "cancelled"],
  rejected: [],
  submitted: ["preparing_documents", "rejected", "cancelled"],
};

const FORMAL_DOCUMENT_LABELS: Record<string, string> = {
  exchange: "Коммерческий документ",
  fx_execute: "FX Execute",
  fx_resolution: "FX Resolution",
  invoice: "Инвойс",
  transfer_intra: "Внутренний перевод",
  transfer_intercompany: "Межкомпанейский перевод",
  transfer_resolution: "Transfer Resolution",
};

function minorToDecimalString(amountMinor: string, precision: number) {
  const value = BigInt(amountMinor);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString();

  if (precision === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(precision + 1, "0");
  const integerPart = padded.slice(0, padded.length - precision);
  const fractionPart = padded.slice(padded.length - precision);

  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

function rationalToDecimalString(
  numerator: string,
  denominator: string,
  scale = 6,
) {
  const num = BigInt(numerator);
  const den = BigInt(denominator);

  if (den === 0n) {
    throw new Error("Cannot format rate with zero denominator");
  }

  const negative = (num < 0n) !== (den < 0n);
  const absoluteNum = num < 0n ? -num : num;
  const absoluteDen = den < 0n ? -den : den;
  const integerPart = absoluteNum / absoluteDen;
  let remainder = absoluteNum % absoluteDen;
  let fraction = "";

  for (let index = 0; index < scale; index += 1) {
    remainder *= 10n;
    fraction += (remainder / absoluteDen).toString();
    remainder %= absoluteDen;
  }

  const trimmedFraction = fraction.replace(/0+$/, "");
  const prefix = negative ? "-" : "";
  return trimmedFraction ? `${prefix}${integerPart}.${trimmedFraction}` : `${prefix}${integerPart}`;
}

function feeBpsToPercentString(feeBps: string) {
  return minorToDecimalString(feeBps, 2);
}

function formatCurrency(value: string | number | null, currency?: string | null) {
  if (value === null) {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency ?? "RUB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateShort(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5" />;
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return <FileType className="h-5 w-5" />;
  }
  return <Paperclip className="h-5 w-5" />;
}

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
        customer,
        deal,
        formalDocuments,
        legalEntity,
        organization,
        organizationRequisite,
        organizationRequisiteProvider,
        requestedCurrencyCode: requestedCurrency?.code ?? null,
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              Сделка #{getUuidPrefix(data.deal.id)}
            </h1>
            <Badge className={STATUS_COLORS[data.deal.status]}>
              {STATUS_LABELS[data.deal.status]}
            </Badge>
          </div>
        </div>

        {statusOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="default" size="sm" />}
            >
              Изменить статус
              <ChevronDown className="ml-2 h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Доступные переходы</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {statusOptions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusUpdate(status)}
                >
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Сделка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Тип
                  </div>
                  <div className="text-base">{DEAL_TYPE_LABELS[data.deal.type]}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Дата создания
                  </div>
                  <div className="text-base">{formatDate(data.deal.createdAt)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Последнее обновление
                  </div>
                  <div className="text-base">{formatDate(data.deal.updatedAt)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Запрошенная сумма
                  </div>
                  <div className="text-base font-medium">
                    {formatCurrency(
                      data.deal.requestedAmount,
                      data.requestedCurrencyCode,
                    )}
                  </div>
                </div>
                {data.deal.reason && (
                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Основание
                    </div>
                    <div className="text-base">{data.deal.reason}</div>
                  </div>
                )}
                {data.deal.intakeComment && (
                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Комментарий intake
                    </div>
                    <div className="text-base">{data.deal.intakeComment}</div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    Комментарий
                  </div>
                  {!isEditingComment && (
                    <Button variant="outline" size="sm" onClick={handleEditComment}>
                      <Edit className="mr-2 h-4 w-4" />
                      {data.deal.comment ? "Редактировать" : "Добавить"}
                    </Button>
                  )}
                </div>

                {isEditingComment ? (
                  <div className="space-y-3">
                    <Textarea
                      disabled={isSavingComment}
                      onChange={(event) => setCommentValue(event.target.value)}
                      placeholder="Комментарий по сделке"
                      rows={4}
                      value={commentValue}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={isSavingComment}
                        onClick={handleSaveComment}
                        size="sm"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingComment ? "Сохранение..." : "Сохранить"}
                      </Button>
                      <Button
                        disabled={isSavingComment}
                        onClick={handleCancelEditComment}
                        size="sm"
                        variant="outline"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-base">
                    {data.deal.comment || (
                      <span className="italic text-muted-foreground">
                        Комментарий отсутствует
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                Финансовая информация
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.calculation ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Валюта расчета
                    </div>
                    <div className="text-base">{data.calculation.currencyCode}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Сумма
                    </div>
                    <div className="text-base font-medium">
                      {formatCurrency(
                        data.calculation.originalAmount,
                        data.calculation.currencyCode,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Комиссия
                    </div>
                    <div className="text-base">
                      {data.calculation.feePercentage}% (
                      {formatCurrency(
                        data.calculation.feeAmount,
                        data.calculation.currencyCode,
                      )}
                      )
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Курс
                    </div>
                    <div className="text-base">{data.calculation.rate}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Доп. расходы
                    </div>
                    <div className="text-base">
                      {formatCurrency(
                        data.calculation.additionalExpenses,
                        data.calculation.additionalExpensesCurrencyCode ??
                          data.calculation.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Итого в базе
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(
                        data.calculation.totalWithExpensesInBase,
                        data.calculation.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Расчет к сделке не привязан.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-muted-foreground" />
                Формальные документы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.formalDocuments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  По сделке еще нет формальных документов.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.formalDocuments.map((document) => (
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
                            {document.docType} · {formatDate(document.createdAt)}
                          </div>
                          {document.amount && (
                            <div className="text-sm">
                              {formatCurrency(document.amount, document.currency)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            submission: {document.submissionStatus}
                          </Badge>
                          <Badge variant="outline">
                            approval: {document.approvalStatus}
                          </Badge>
                          <Badge variant="outline">
                            posting: {document.postingStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <File className="h-5 w-5 text-muted-foreground" />
                  Вложения
                </CardTitle>
                <Button
                  onClick={() => setIsUploadDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Загрузить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  По сделке пока нет загруженных вложений.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="shrink-0">
                          {getFileIcon(attachment.mimeType)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {attachment.fileName}
                          </div>
                          {attachment.description && (
                            <div className="truncate text-sm text-muted-foreground">
                              {attachment.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)} ·{" "}
                            {formatDate(attachment.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            window.open(
                              `${API_BASE_URL}/deals/${dealId}/attachments/${attachment.id}/download`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          size="sm"
                          title="Скачать"
                          variant="ghost"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={deletingAttachmentId === attachment.id}
                          onClick={() => handleAttachmentDelete(attachment.id)}
                          size="sm"
                          title="Удалить"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-muted-foreground" />
                Клиент
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Customer
                </div>
                <div className="text-base font-medium">
                  {data.customer.displayName}
                </div>
              </div>
              {data.customer.externalRef && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Внешний ID
                  </div>
                  <div className="text-base">{data.customer.externalRef}</div>
                </div>
              )}
              {data.customer.description && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Описание
                  </div>
                  <div className="text-base">{data.customer.description}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Юридическое лицо клиента
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.legalEntity ? (
                <>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Название
                    </div>
                    <div className="text-base font-medium">
                      {data.legalEntity.orgName}
                    </div>
                  </div>
                  {data.legalEntity.fullName !== data.legalEntity.orgName && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Полное наименование
                      </div>
                      <div className="text-base">{data.legalEntity.fullName}</div>
                    </div>
                  )}
                  {data.legalEntity.inn && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        ИНН
                      </div>
                      <div className="text-base">{data.legalEntity.inn}</div>
                    </div>
                  )}
                  {data.legalEntity.kpp && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        КПП
                      </div>
                      <div className="text-base">{data.legalEntity.kpp}</div>
                    </div>
                  )}
                  {data.legalEntity.directorName && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Руководитель
                      </div>
                      <div className="text-base">{data.legalEntity.directorName}</div>
                      {data.legalEntity.position && (
                        <div className="text-sm text-muted-foreground">
                          {data.legalEntity.position}
                        </div>
                      )}
                    </div>
                  )}
                  {data.legalEntity.phone && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Телефон
                      </div>
                      <div className="text-base">{data.legalEntity.phone}</div>
                    </div>
                  )}
                  {data.legalEntity.email && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Email
                      </div>
                      <div className="text-base">{data.legalEntity.email}</div>
                    </div>
                  )}
                  {data.legalEntity.subAgent && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Субагент
                      </div>
                      <div className="text-base">
                        {data.legalEntity.subAgent.shortName} ·{" "}
                        {data.legalEntity.subAgent.commissionRate}%
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Для сделки еще не выбрано юридическое лицо клиента.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Агентский договор
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={data.agreement.isActive ? "default" : "secondary"}>
                  {data.agreement.isActive ? "Действует" : "Не активен"}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Версия {data.agreement.currentVersion.versionNumber}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Номер договора
                </div>
                <div className="text-base">
                  {data.agreement.currentVersion.contractNumber || "—"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Дата договора
                </div>
                <div className="text-base">
                  {formatDateShort(data.agreement.currentVersion.contractDate)}
                </div>
              </div>
              {data.agreement.currentVersion.feeRules.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Условия
                  </div>
                  {data.agreement.currentVersion.feeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      {formatAgreementFeeRuleLabel(rule)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Организация агента
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Название
                </div>
                <div className="text-base font-medium">
                  {data.organization.shortName}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Полное наименование
                </div>
                <div className="text-base">{data.organization.fullName}</div>
              </div>
              {data.organization.inn && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    ИНН
                  </div>
                  <div className="text-base">{data.organization.inn}</div>
                </div>
              )}
              {data.organization.kpp && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    КПП
                  </div>
                  <div className="text-base">{data.organization.kpp}</div>
                </div>
              )}
              {data.organization.address && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Адрес
                  </div>
                  <div className="text-base">{data.organization.address}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-muted-foreground" />
                Банковский реквизит организации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Реквизит
                </div>
                <div className="text-base font-medium">
                  {data.organizationRequisite.label}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Банк
                </div>
                <div className="text-base">
                  {data.organizationRequisiteProvider?.name || "—"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Счет / IBAN
                </div>
                <div className="break-all font-mono text-sm">
                  {data.organizationRequisite.accountNo ||
                    data.organizationRequisite.iban ||
                    "—"}
                </div>
              </div>
              {data.organizationRequisite.corrAccount && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Корр. счет
                  </div>
                  <div className="break-all font-mono text-sm">
                    {data.organizationRequisite.corrAccount}
                  </div>
                </div>
              )}
              {data.organizationRequisiteProvider?.bic && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    BIC
                  </div>
                  <div className="font-mono text-sm">
                    {data.organizationRequisiteProvider.bic}
                  </div>
                </div>
              )}
              {data.organizationRequisiteProvider?.swift && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    SWIFT
                  </div>
                  <div className="font-mono text-sm">
                    {data.organizationRequisiteProvider.swift}
                  </div>
                </div>
              )}
              {data.organizationRequisiteProvider?.address && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Адрес банка
                  </div>
                  <div className="text-base">
                    {data.organizationRequisiteProvider.address}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                История статусов
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.deal.statusHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  История статусов отсутствует.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.deal.statusHistory.map((entry) => (
                    <div key={entry.id} className="border-l-2 pl-3">
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[entry.status]}>
                          {STATUS_LABELS[entry.status]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      {entry.comment && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          {entry.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open);
          if (!open) {
            setUploadDescription("");
            setUploadFile(null);
          }
        }}
        open={isUploadDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Загрузить вложение</DialogTitle>
            <DialogDescription>
              Добавьте файл к сделке. Это отдельное вложение, не формальный
              документ.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="deal-attachment-file">Файл</Label>
              <Input
                id="deal-attachment-file"
                onChange={(event) => {
                  setUploadFile(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
              {uploadFile && (
                <div className="text-sm text-muted-foreground">
                  {uploadFile.name} · {formatFileSize(uploadFile.size)}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-attachment-description">
                Описание
              </Label>
              <Input
                id="deal-attachment-description"
                onChange={(event) => setUploadDescription(event.target.value)}
                placeholder="Например: подписанный комплект"
                value={uploadDescription}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsUploadDialogOpen(false);
                setUploadDescription("");
                setUploadFile(null);
              }}
              variant="outline"
            >
              Отмена
            </Button>
            <Button
              disabled={!uploadFile || isUploadingAttachment}
              onClick={handleAttachmentUpload}
            >
              {isUploadingAttachment ? "Загрузка..." : "Загрузить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={errorDialog.isOpen}
        onOpenChange={(open) =>
          setErrorDialog((current) => ({ ...current, isOpen: open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Понятно</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
