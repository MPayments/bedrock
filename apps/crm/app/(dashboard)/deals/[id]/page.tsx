"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  ChevronLeft,
  FileText,
  Building2,
  Upload,
  Calculator,
  Users,
  Landmark,
  FileCheck,
  FileSignature,
  Printer,
  FileIcon,
  ChevronDown,
  XCircle,
  Upload as UploadIcon,
  Download,
  Trash2,
  File,
  FileImage,
  FileType,
  Archive,
  Paperclip,
  Edit,
  Save,
  X,
  Info,
  CalendarIcon,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";
import { useSession } from "@/lib/auth-client";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bedrock/sdk-ui/components/tooltip";
import { cn } from "@/lib/utils";
import {
  format as formatFns,
  parseISO,
  isValid,
  setHours,
  setMinutes,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar } from "@bedrock/sdk-ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";

type DealStatus =
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

interface Deal {
  id: number;
  applicationId: number;
  calculationId: number;
  agentOrganizationBankDetailsId: number;
  status: DealStatus;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  companyName: string | null;
  companyNameI18n?: { ru?: string | null; en?: string | null } | null;
  bankName: string | null;
  bankNameI18n?: { ru?: string | null; en?: string | null } | null;
  account: string | null;
  swiftCode: string | null;
  contractDate: string | null;
  contractNumber: string | null;
  costPrice: string | null;
  closedAt: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Calculation {
  id: number;
  applicationId: number;
  currencyCode: string;
  originalAmount: string;
  feePercentage: string;
  feeAmount: string;
  totalAmount: string;
  rateSource: string;
  rate: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpenses: string;
  baseCurrencyCode: string;
  feeAmountInBase: string;
  totalInBase: string;
  additionalExpensesInBase: string;
  totalWithExpensesInBase: string;
  calculationTimestamp: string;
  sentToClient: number;
  status: string;
  createdAt: string;
}

interface Application {
  id: number;
  agentId: string | null;
  clientId: number;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Client {
  id: number;
  orgName: string;
  orgType: string | null;
  directorName: string | null;
  position: string | null;
  directorBasis: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
  bankName: string | null;
  bankAddress: string | null;
  account: string | null;
  bic: string | null;
  corrAccount: string | null;
}

interface Contract {
  id: number;
  clientId: number;
  agentOrganizationId: number;
  contractNumber: string;
  contractDate: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationBank {
  id: number;
  organizationId: number;
  name: string;
  account: string;
  bic: string;
  corrAccount: string | null;
  swiftCode: string | null;
  bankAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Organization {
  id: number;
  name: string;
  fullName: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  directorName: string | null;
  position: string | null;
  directorBasis: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: number;
  name: string;
  email: string;
}

interface SubAgent {
  id: number;
  name: string;
  commission: number;
}

interface DealDocument {
  id: number;
  dealId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  uploadedBy: number;
  createdAt: string;
  updatedAt: string;
}

interface DealDetailResponse {
  deal: Deal;
  calculation: Calculation;
  application: Application;
  client: Client;
  contract: Contract;
  organizationBank: OrganizationBank;
  organization: Organization;
  agent: Agent;
  subAgent: SubAgent | null;
}

const STATUS_LABELS: Record<DealStatus, string> = {
  preparing_documents: "Подготовка документов",
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  closing_documents: "Закрывающие документы",
  done: "Завершена",
  cancelled: "Отменена",
};

const STATUS_COLORS: Record<DealStatus, string> = {
  preparing_documents: "bg-amber-100 text-amber-800",
  awaiting_funds: "bg-orange-100 text-orange-800",
  awaiting_payment: "bg-yellow-100 text-yellow-800",
  closing_documents: "bg-cyan-100 text-cyan-800",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

function formatCurrency(value: string | number, currency?: string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
    }).format(numValue);
  } catch {
    return new Intl.NumberFormat("ru-RU").format(numValue);
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = parseISO(value);
  if (!isValid(date)) return "—";
  return formatFns(date, "dd.MM.yyyy HH:mm", { locale: ru });
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "—";
  const date = parseISO(value);
  if (!isValid(date)) return "—";
  return formatFns(date, "dd.MM.yyyy", { locale: ru });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
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
  if (mimeType === "application/zip") {
    return <Archive className="h-5 w-5" />;
  }
  return <Paperclip className="h-5 w-5" />;
}

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [data, setData] = useState<DealDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Диалоги
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);

  // Форма инвойса
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    companyName: "",
    companyNameEn: "",
    bankName: "",
    bankNameEn: "",
    account: "",
    swiftCode: "",
  });

  // Форма контракта
  const [contractForm, setContractForm] = useState({
    contractNumber: "",
    contractDate: "",
  });

  // Загрузка файлов
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentLang, setDocumentLang] = useState<"ru" | "en">("ru");

  // AlertDialog для ошибок
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showError = (title: string, message: string) => {
    setErrorDialog({ isOpen: true, title, message });
  };

  // AlertDialog для подтверждения отмены сделки
  const [cancelDealDialog, setCancelDealDialog] = useState(false);

  // Диалог закрытия сделки
  const [isCloseDealDialogOpen, setIsCloseDealDialogOpen] = useState(false);
  const [costPrice, setCostPrice] = useState("");
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [closeDealPreview, setCloseDealPreview] = useState<{
    costPrice: number;
    agentFee: number;
    totalWithExpenses: number;
  } | null>(null);

  // Документы сделки
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isUploadDocumentDialogOpen, setIsUploadDocumentDialogOpen] =
    useState(false);
  const [uploadDocumentFile, setUploadDocumentFile] = useState<File | null>(
    null,
  );
  const [uploadDocumentDescription, setUploadDocumentDescription] =
    useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(
    null,
  );

  // Даты сделки
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [datesForm, setDatesForm] = useState<{
    createdAt: Date | undefined;
    closedAt: Date | undefined;
  }>({ createdAt: undefined, closedAt: undefined });
  const [isSavingDates, setIsSavingDates] = useState(false);

  // Комментарий
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  const dealId = params?.id as string;

  const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
    preparing_documents: ["awaiting_funds", "cancelled"],
    awaiting_funds: ["awaiting_payment", "cancelled"],
    awaiting_payment: ["closing_documents", "cancelled"],
    closing_documents: ["cancelled"],
    done: [],
    cancelled: [],
  };

  const getAvailableStatuses = (
    currentStatus: DealStatus,
    hasContract: boolean,
  ): Array<{ status: DealStatus; disabled: boolean; reason?: string }> => {
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (allowed.length === 0) return [];

    return allowed.map((status) => {
      if (!hasContract && status !== "cancelled") {
        return {
          status,
          disabled: true,
          reason: "Необходимо загрузить контракт или инвойс",
        };
      }
      return { status, disabled: false };
    });
  };

  const handleStatusUpdate = async (newStatus: DealStatus) => {
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка обновления: ${res.status}`,
        );
      }

      await fetchData(); // Перезагрузка данных
    } catch (err) {
      console.error("Status update error:", err);
      showError(
        "Ошибка обновления статуса",
        err instanceof Error ? err.message : "Ошибка обновления статуса",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE_URL}/deals/${dealId}`;
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Сделка не найдена");
        }
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const response: DealDetailResponse = await res.json();
      setData(response);
    } catch (err) {
      console.error("Deal fetch error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const convertDateToInputFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split(".");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return dateStr;
  };

  const convertDateFromInputFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }
    return dateStr;
  };

  const handleInvoiceFileUpload = async (file: File) => {
    try {
      setIsUploadingInvoice(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE_URL}/deals/${dealId}/invoice/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка обработки: ${res.status}`);
      }

      const result = await res.json();
      setInvoiceForm({
        invoiceNumber: result.data.invoiceNumber || "",
        invoiceDate: convertDateToInputFormat(result.data.invoiceDate || ""),
        companyName: result.data.companyName || "",
        companyNameEn: result.data.companyNameI18n?.en || "",
        bankName: result.data.bankName || "",
        bankNameEn: result.data.bankNameI18n?.en || "",
        account: result.data.account || "",
        swiftCode: result.data.swiftCode || "",
      });
      setInvoiceFile(null);
    } catch (err) {
      console.error("Invoice file upload error:", err);
      showError(
        "Ошибка обработки файла",
        err instanceof Error ? err.message : "Ошибка обработки файла",
      );
      setInvoiceFile(null);
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  const handleInvoiceSubmit = async () => {
    try {
      setIsSubmitting(true);

      const dataToSubmit = {
        invoiceNumber: invoiceForm.invoiceNumber,
        invoiceDate: convertDateFromInputFormat(invoiceForm.invoiceDate),
        companyName: invoiceForm.companyName,
        bankName: invoiceForm.bankName,
        account: invoiceForm.account,
        swiftCode: invoiceForm.swiftCode,
        companyNameI18n: {
          ru: invoiceForm.companyName || undefined,
          en: invoiceForm.companyNameEn || undefined,
        },
        bankNameI18n: {
          ru: invoiceForm.bankName || undefined,
          en: invoiceForm.bankNameEn || undefined,
        },
      };

      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dataToSubmit),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка загрузки: ${res.status}`);
      }

      setIsInvoiceDialogOpen(false);
      setInvoiceForm({
        invoiceNumber: "",
        invoiceDate: "",
        companyName: "",
        companyNameEn: "",
        bankName: "",
        bankNameEn: "",
        account: "",
        swiftCode: "",
      });
      await fetchData();
    } catch (err) {
      console.error("Invoice upload error:", err);
      showError(
        "Ошибка загрузки инвойса",
        err instanceof Error ? err.message : "Ошибка загрузки инвойса",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContractFileUpload = async (file: File) => {
    try {
      setIsUploadingContract(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE_URL}/deals/${dealId}/contract/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка обработки: ${res.status}`);
      }

      const result = await res.json();
      setContractForm({
        contractNumber: result.data.contractNumber || "",
        contractDate: convertDateToInputFormat(result.data.contractDate || ""),
      });
      setContractFile(null);
    } catch (err) {
      console.error("Contract file upload error:", err);
      showError(
        "Ошибка обработки файла",
        err instanceof Error ? err.message : "Ошибка обработки файла",
      );
      setContractFile(null);
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleContractSubmit = async () => {
    try {
      setIsSubmitting(true);

      const dataToSubmit = {
        ...contractForm,
        contractDate: convertDateFromInputFormat(contractForm.contractDate),
      };

      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dataToSubmit),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка загрузки: ${res.status}`);
      }

      setIsContractDialogOpen(false);
      setContractForm({
        contractNumber: "",
        contractDate: "",
      });
      await fetchData();
    } catch (err) {
      console.error("Contract upload error:", err);
      showError(
        "Ошибка загрузки контракта",
        err instanceof Error ? err.message : "Ошибка загрузки контракта",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadDocument = async (
    type: "application" | "invoice" | "acceptance",
    format: "pdf" | "docx" = "pdf",
  ) => {
    try {
      const url = `${API_BASE_URL}/deals/${dealId}/documents/${type}?format=${format}&lang=${documentLang}`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка скачивания: ${res.status}`,
        );
      }

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `document.${format}`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          contentDisposition,
        );
        if (matches?.[1]) {
          filename = decodeURIComponent(matches[1].replace(/['"]/g, ""));
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Document download error:", err);
      showError(
        "Ошибка скачивания документа",
        err instanceof Error ? err.message : "Ошибка скачивания документа",
      );
    }
  };

  const handleCloseDeal = async () => {
    try {
      setIsClosingDeal(true);
      const parsedCostPrice = parseFloat(
        costPrice.replace(/\s+/g, "").replace(/,/g, "."),
      );

      if (isNaN(parsedCostPrice) || parsedCostPrice <= 0) {
        showError(
          "Некорректная себестоимость",
          "Пожалуйста, введите корректное значение себестоимости",
        );
        return;
      }

      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ costPrice: parsedCostPrice }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка закрытия: ${res.status}`);
      }

      const result = await res.json();
      setCloseDealPreview(result);
      setIsCloseDealDialogOpen(false);
      setCostPrice("");
      await fetchData();
    } catch (err) {
      console.error("Close deal error:", err);
      showError(
        "Ошибка закрытия сделки",
        err instanceof Error ? err.message : "Ошибка закрытия сделки",
      );
    } finally {
      setIsClosingDeal(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/documents`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const docs: DealDocument[] = await res.json();
      setDocuments(docs);
    } catch (err) {
      console.error("Documents fetch error:", err);
      showError(
        "Ошибка загрузки документов",
        err instanceof Error ? err.message : "Ошибка загрузки документов",
      );
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!uploadDocumentFile) {
      showError("Ошибка", "Выберите файл для загрузки");
      return;
    }

    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append("file", uploadDocumentFile);
      // Передаем оригинальное имя файла отдельно для правильной кодировки
      formData.append("fileName", uploadDocumentFile.name);
      if (uploadDocumentDescription) {
        formData.append("description", uploadDocumentDescription);
      }

      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка загрузки: ${res.status}`);
      }

      setIsUploadDocumentDialogOpen(false);
      setUploadDocumentFile(null);
      setUploadDocumentDescription("");
      await fetchDocuments();
    } catch (err) {
      console.error("Document upload error:", err);
      showError(
        "Ошибка загрузки документа",
        err instanceof Error ? err.message : "Ошибка загрузки документа",
      );
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDocumentDownload = async (
    documentId: number,
    fileName: string,
  ) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/deals/${dealId}/documents/${documentId}/download`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка скачивания: ${res.status}`,
        );
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error("Ссылка на файл не найдена");
      }

      const fileRes = await fetch(data.url);
      if (!fileRes.ok) {
        throw new Error(`Ошибка скачивания файла: ${fileRes.status}`);
      }

      const blob = await fileRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Document download error:", err);
      showError(
        "Ошибка скачивания документа",
        err instanceof Error ? err.message : "Ошибка скачивания документа",
      );
    }
  };

  const handleDocumentDelete = async (documentId: number) => {
    try {
      setDeletingDocumentId(documentId);
      const res = await fetch(
        `${API_BASE_URL}/deals/${dealId}/documents/${documentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка удаления: ${res.status}`);
      }

      await fetchDocuments();
    } catch (err) {
      console.error("Document delete error:", err);
      showError(
        "Ошибка удаления документа",
        err instanceof Error ? err.message : "Ошибка удаления документа",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleEditComment = () => {
    setCommentValue(data?.deal.comment || "");
    setIsEditingComment(true);
  };

  const handleCancelEditComment = () => {
    setIsEditingComment(false);
    setCommentValue("");
  };

  const handleSaveComment = async () => {
    try {
      setIsSavingComment(true);
      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/comment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: commentValue }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка обновления комментария: ${res.status}`,
        );
      }

      // Успешно сохранено - обновляем данные
      setIsEditingComment(false);
      await fetchData();
    } catch (err) {
      console.error("Save comment error:", err);
      showError(
        "Ошибка сохранения комментария",
        err instanceof Error ? err.message : "Не удалось сохранить комментарий",
      );
    } finally {
      setIsSavingComment(false);
    }
  };

  const parseToDate = (value: string | null | undefined): Date | undefined => {
    if (!value) return undefined;
    const date = parseISO(value);
    return isValid(date) ? date : undefined;
  };

  const handleEditDates = () => {
    setDatesForm({
      createdAt: parseToDate(data?.deal.createdAt),
      closedAt: parseToDate(data?.deal.closedAt),
    });
    setIsEditingDates(true);
  };

  const handleCancelEditDates = () => {
    setIsEditingDates(false);
    setDatesForm({ createdAt: undefined, closedAt: undefined });
  };

  const handleSaveDates = async () => {
    try {
      setIsSavingDates(true);
      const payload: { createdAt?: string; closedAt?: string | null } = {};

      if (datesForm.createdAt) {
        payload.createdAt = datesForm.createdAt.toISOString();
      }
      payload.closedAt = datesForm.closedAt
        ? datesForm.closedAt.toISOString()
        : null;

      const res = await fetch(`${API_BASE_URL}/deals/${dealId}/dates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка обновления дат: ${res.status}`,
        );
      }

      setIsEditingDates(false);
      await fetchData();
    } catch (err) {
      console.error("Save dates error:", err);
      showError(
        "Ошибка сохранения дат",
        err instanceof Error ? err.message : "Не удалось сохранить даты",
      );
    } finally {
      setIsSavingDates(false);
    }
  };

  useEffect(() => {
    if (dealId) {
      fetchData();
      fetchDocuments();
    }
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Назад
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error || "Не удалось загрузить данные"}
        </div>
      </div>
    );
  }

  const {
    deal,
    calculation,
    application,
    client,
    contract,
    organizationBank,
    organization,
    agent,
    subAgent,
  } = data;

  return (
    <div className="space-y-4">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Сделка #{deal.id}</h1>
          <Badge className={STATUS_COLORS[deal.status]}>
            {STATUS_LABELS[deal.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {deal.status !== "done" && deal.status !== "cancelled" && (
            <>
              {/* Дропдаун выбора статуса */}
              {(() => {
                const availableStatuses = getAvailableStatuses(
                  deal.status,
                  !!deal.contractNumber || !!deal.invoiceNumber,
                );

                return availableStatuses.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="default" size="sm" />}
                    >
                      Изменить статус
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Выбрать статус</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableStatuses.map((item) =>
                        item.disabled && item.reason ? (
                          <Tooltip key={item.status}>
                            <TooltipTrigger render={<div />}>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                }}
                                disabled={true}
                                className="cursor-not-allowed opacity-50"
                              >
                                <span className="flex items-center gap-2">
                                  {STATUS_LABELS[item.status]}
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </span>
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{item.reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <DropdownMenuItem
                            key={item.status}
                            onClick={() => handleStatusUpdate(item.status)}
                            disabled={isUpdatingStatus}
                          >
                            {STATUS_LABELS[item.status]}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null;
              })()}

              {/* Кнопка закрытия сделки только для closing_documents */}
              {deal.status === "closing_documents" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsCloseDealDialogOpen(true)}
                  disabled={isUpdatingStatus}
                >
                  Закрыть сделку
                </Button>
              )}

              {/* Меню действий (Загрузка документов) */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" />}
                >
                  Загрузка документов
                  <ChevronDown className="ml-2 h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Документы</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setIsInvoiceDialogOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {deal.invoiceNumber
                      ? "Обновить инвойс"
                      : "Загрузить инвойс"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsContractDialogOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {deal.contractNumber
                      ? "Обновить контракт"
                      : "Загрузить контракт"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelDealDialog(true)}
                disabled={isUpdatingStatus}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <XCircle className="mr-2 h-4 w-4" /> Отклонить
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Информация о сделке
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Номер сделки
                  </div>
                  <div className="text-base">#{deal.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Статус
                  </div>
                  <div className="text-base">{STATUS_LABELS[deal.status]}</div>
                </div>
                {isAdmin && agent && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Агент
                    </div>
                    <div className="text-base">
                      {agent.name} {agent.email}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Заявка
                  </div>
                  <div className="text-base">
                    <Button
                      variant="link"
                      className="p-0 h-auto cursor-pointer text-blue-800"
                      onClick={() =>
                        router.push(`/applications/${application.id}`)
                      }
                    >
                      Заявка #{application.id}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Дата создания
                  </div>
                  <div className="text-base">{formatDate(deal.createdAt)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Последнее обновление
                  </div>
                  <div className="text-base">{formatDate(deal.updatedAt)}</div>
                </div>
                {deal.closedAt && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Дата закрытия
                    </div>
                    <div className="text-base">{formatDate(deal.closedAt)}</div>
                  </div>
                )}
                {isAdmin && (
                  <div
                    className={
                      deal.closedAt ? "" : "col-span-2 flex justify-end"
                    }
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditDates}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Изменить даты
                    </Button>
                  </div>
                )}
              </div>

              {/* Комментарий */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Комментарий
                  </div>
                  {!isEditingComment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditComment}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {deal.comment ? "Редактировать" : "Добавить"}
                    </Button>
                  )}
                </div>
                {isEditingComment ? (
                  <div className="space-y-2">
                    <Textarea
                      value={commentValue}
                      onChange={(e) => setCommentValue(e.target.value)}
                      placeholder="Введите комментарий..."
                      rows={4}
                      disabled={isSavingComment}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveComment}
                        disabled={isSavingComment}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingComment ? "Сохранение..." : "Сохранить"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditComment}
                        disabled={isSavingComment}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-base">
                    {deal.comment || (
                      <span className="text-muted-foreground italic">
                        Комментарий отсутствует
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Расчёт */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                Финансовая информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Валюта
                  </div>
                  <div className="text-base">{calculation.currencyCode}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Сумма в валюте
                  </div>
                  <div className="text-base font-medium">
                    {formatCurrency(
                      calculation.originalAmount,
                      calculation.currencyCode,
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Курс
                  </div>
                  <div className="text-base">
                    {parseFloat(calculation.rate).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Комиссия
                  </div>
                  <div className="text-base">
                    {calculation.feePercentage}% (
                    {formatCurrency(calculation.feeAmountInBase)})
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Доп. расходы
                  </div>
                  <div className="text-base">
                    {formatCurrency(calculation.additionalExpenses)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Итого с расходами ({calculation.baseCurrencyCode || "RUB"})
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(calculation.totalWithExpensesInBase)}
                  </div>
                </div>
                {deal.costPrice && (
                  <>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Себестоимость
                      </div>
                      <div className="text-base">
                        {formatCurrency(deal.costPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Маржа
                      </div>
                      <div
                        className={cn(
                          "text-base font-bold",
                          parseFloat(calculation.totalWithExpensesInBase) -
                            parseFloat(deal.costPrice) >
                            0
                            ? "text-green-600"
                            : "text-red-600",
                        )}
                      >
                        {formatCurrency(
                          parseFloat(calculation.totalWithExpensesInBase) -
                            parseFloat(deal.costPrice),
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {subAgent && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Субагент
                  </div>
                  <div className="text-base">
                    {subAgent.name} ({subAgent.commission}%)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Скрытые диалоги (для работы кнопок из хедера) */}
          <Dialog
            open={isInvoiceDialogOpen}
            onOpenChange={setIsInvoiceDialogOpen}
          >
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Загрузка данных инвойса</DialogTitle>
                <DialogDescription>
                  Загрузите файл инвойса (PDF, Word или Excel) для
                  автоматического извлечения данных или введите их вручную
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="invoiceFile">
                    Загрузить файл (PDF, Word, Excel)
                  </Label>
                  <Input
                    id="invoiceFile"
                    type="file"
                    accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setInvoiceFile(file);
                        handleInvoiceFileUpload(file);
                      }
                    }}
                    disabled={isUploadingInvoice}
                  />
                  {isUploadingInvoice && (
                    <p className="text-sm text-muted-foreground">
                      Обработка файла с помощью AI...
                    </p>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Или введите вручную
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invoiceNumber">Номер инвойса</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        invoiceNumber: e.target.value,
                      })
                    }
                    placeholder="INV-2024-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invoiceDate">Дата инвойса</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceForm.invoiceDate}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        invoiceDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Название компании</Label>
                  <Input
                    id="companyName"
                    value={invoiceForm.companyName}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        companyName: e.target.value,
                      })
                    }
                    placeholder="Company Ltd."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyNameEn">Название компании (EN)</Label>
                  <Input
                    id="companyNameEn"
                    value={invoiceForm.companyNameEn}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        companyNameEn: e.target.value,
                      })
                    }
                    placeholder="Company Ltd."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bankName">Название банка</Label>
                  <Input
                    id="bankName"
                    value={invoiceForm.bankName}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        bankName: e.target.value,
                      })
                    }
                    placeholder="Bank Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bankNameEn">Название банка (EN)</Label>
                  <Input
                    id="bankNameEn"
                    value={invoiceForm.bankNameEn}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        bankNameEn: e.target.value,
                      })
                    }
                    placeholder="Bank Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="account">Номер счёта</Label>
                  <Input
                    id="account"
                    value={invoiceForm.account}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        account: e.target.value,
                      })
                    }
                    placeholder="123456789"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="swiftCode">SWIFT код</Label>
                  <Input
                    id="swiftCode"
                    value={invoiceForm.swiftCode}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        swiftCode: e.target.value,
                      })
                    }
                    placeholder="ABCDUS33XXX"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsInvoiceDialogOpen(false)}
                  disabled={isSubmitting || isUploadingInvoice}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleInvoiceSubmit}
                  disabled={isSubmitting || isUploadingInvoice}
                >
                  {isUploadingInvoice
                    ? "Обработка файла..."
                    : isSubmitting
                    ? "Сохранение..."
                    : "Сохранить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isContractDialogOpen}
            onOpenChange={setIsContractDialogOpen}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Загрузка данных контракта</DialogTitle>
                <DialogDescription>
                  Загрузите файл контракта (PDF, Word или Excel) для
                  автоматического извлечения данных или введите их вручную
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="contractFile">
                    Загрузить файл (PDF, Word, Excel)
                  </Label>
                  <Input
                    id="contractFile"
                    type="file"
                    accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setContractFile(file);
                        handleContractFileUpload(file);
                      }
                    }}
                    disabled={isUploadingContract}
                  />
                  {isUploadingContract && (
                    <p className="text-sm text-muted-foreground">
                      Обработка файла с помощью AI...
                    </p>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Или введите вручную
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contractNumber">Номер контракта</Label>
                  <Input
                    id="contractNumber"
                    value={contractForm.contractNumber}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        contractNumber: e.target.value,
                      })
                    }
                    placeholder="CTR-2024-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contractDate">Дата контракта</Label>
                  <Input
                    id="contractDate"
                    type="date"
                    value={contractForm.contractDate}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        contractDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsContractDialogOpen(false)}
                  disabled={isSubmitting || isUploadingContract}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleContractSubmit}
                  disabled={isSubmitting || isUploadingContract}
                >
                  {isUploadingContract
                    ? "Обработка файла..."
                    : isSubmitting
                    ? "Сохранение..."
                    : "Сохранить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Документы (Отображение загруженных) */}
          {(deal.invoiceNumber || deal.contractNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-muted-foreground" />
                  Документы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deal.invoiceNumber && (
                  <div className="border rounded-lg p-4">
                    <div className="font-medium mb-2">Инвойс</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Номер
                        </div>
                        <div>{deal.invoiceNumber}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Дата
                        </div>
                        <div>{formatDateShort(deal.invoiceDate)}</div>
                      </div>
                      {deal.companyName && (
                        <div className="col-span-2">
                          <div className="text-sm text-muted-foreground">
                            Компания
                          </div>
                          <div>{deal.companyName}</div>
                        </div>
                      )}
                      {deal.bankName && (
                        <div className="col-span-2">
                          <div className="text-sm text-muted-foreground">
                            Банк
                          </div>
                          <div>{deal.bankName}</div>
                        </div>
                      )}
                      {deal.account && (
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Счет
                          </div>
                          <div className="font-mono text-sm">
                            {deal.account}
                          </div>
                        </div>
                      )}
                      {deal.swiftCode && (
                        <div>
                          <div className="text-sm text-muted-foreground">
                            SWIFT
                          </div>
                          <div className="font-mono text-sm">
                            {deal.swiftCode}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {deal.contractNumber && (
                  <div className="border rounded-lg p-4">
                    <div className="font-medium mb-2">Контракт</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Номер
                        </div>
                        <div>{deal.contractNumber}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Дата
                        </div>
                        <div>{formatDateShort(deal.contractDate)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Генерация документов */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-muted-foreground" />
                Загрузка документов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Язык подстановки:
                </span>
                <Button
                  type="button"
                  variant={documentLang === "ru" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDocumentLang("ru")}
                >
                  RU
                </Button>
                <Button
                  type="button"
                  variant={documentLang === "en" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDocumentLang("en")}
                >
                  EN
                </Button>
              </div>
              <div className="space-y-1">
                {/* Заявка */}
                <div className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <FileIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Заявка</div>
                      {(!deal.companyName ||
                        !deal.bankName ||
                        !deal.account ||
                        !deal.swiftCode) && (
                        <p className="text-xs text-muted-foreground">
                          Нужен инвойс
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("application", "pdf")}
                      disabled={
                        !deal.companyName ||
                        !deal.bankName ||
                        !deal.account ||
                        !deal.swiftCode
                      }
                    >
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("application", "docx")}
                      disabled={
                        !deal.companyName ||
                        !deal.bankName ||
                        !deal.account ||
                        !deal.swiftCode
                      }
                    >
                      DOCX
                    </Button>
                  </div>
                </div>

                {/* Счёт на оплату */}
                <div className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                      <FileIcon className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="font-medium text-sm">Счёт на оплату</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("invoice", "pdf")}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("invoice", "docx")}
                    >
                      DOCX
                    </Button>
                  </div>
                </div>

                {/* Акт */}
                <div className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center">
                      <FileIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        Акт оказанных услуг
                      </div>
                      {deal.status !== "done" && (
                        <p className="text-xs text-muted-foreground">
                          Только для завершённых
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("acceptance", "pdf")}
                      disabled={deal.status !== "done"}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => downloadDocument("acceptance", "docx")}
                      disabled={deal.status !== "done"}
                    >
                      DOCX
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Загруженные документы */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <File className="h-5 w-5 text-muted-foreground" />
                  Загруженные документы
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadDocumentDialogOpen(true)}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Загрузить документ
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Загрузка документов...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Нет загруженных документов
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {doc.fileName}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {doc.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)} •{" "}
                            {formatDate(doc.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleDocumentDownload(doc.id, doc.fileName)
                          }
                          title="Скачать"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDocumentDelete(doc.id)}
                          disabled={deletingDocumentId === doc.id}
                          title="Удалить"
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

          {/* Диалог загрузки документа */}
          <Dialog
            open={isUploadDocumentDialogOpen}
            onOpenChange={setIsUploadDocumentDialogOpen}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Загрузить документ</DialogTitle>
                <DialogDescription>
                  Выберите файл для загрузки и добавьте описание (необязательно)
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="documentFile">Файл</Label>
                  <Input
                    id="documentFile"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadDocumentFile(file);
                      }
                    }}
                    disabled={uploadingDocument}
                  />
                  {uploadDocumentFile && (
                    <p className="text-sm text-muted-foreground">
                      {uploadDocumentFile.name} (
                      {formatFileSize(uploadDocumentFile.size)})
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="documentDescription">
                    Описание (необязательно)
                  </Label>
                  <Input
                    id="documentDescription"
                    value={uploadDocumentDescription}
                    onChange={(e) =>
                      setUploadDocumentDescription(e.target.value)
                    }
                    placeholder="Например: Подписанный акт"
                    disabled={uploadingDocument}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDocumentDialogOpen(false);
                    setUploadDocumentFile(null);
                    setUploadDocumentDescription("");
                  }}
                  disabled={uploadingDocument}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleDocumentUpload}
                  disabled={uploadingDocument || !uploadDocumentFile}
                >
                  {uploadingDocument ? "Загрузка..." : "Загрузить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Правая колонка - Информация о клиенте и организации */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Клиент
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Название организации
                </div>
                <div className="text-base font-medium">{client.orgName}</div>
              </div>
              {client.inn && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    ИНН
                  </div>
                  <div className="text-base">{client.inn}</div>
                </div>
              )}
              {client.kpp && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    КПП
                  </div>
                  <div className="text-base">{client.kpp}</div>
                </div>
              )}
              {client.directorName && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Руководитель
                  </div>
                  <div className="text-base">{client.directorName}</div>
                  {client.position && (
                    <div className="text-sm text-muted-foreground">
                      {client.position}
                    </div>
                  )}
                </div>
              )}
              {client.phone && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Телефон
                  </div>
                  <div className="text-base">{client.phone}</div>
                </div>
              )}
              {client.email && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Email
                  </div>
                  <div className="text-base">{client.email}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Организация агента
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Название
                </div>
                <div className="text-base font-medium">{organization.name}</div>
              </div>
              {organization.fullName && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Полное название
                  </div>
                  <div className="text-base">{organization.fullName}</div>
                </div>
              )}
              {organization.inn && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    ИНН
                  </div>
                  <div className="text-base">{organization.inn}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-muted-foreground" />
                Банк организации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Банк
                </div>
                <div className="text-base">{organizationBank.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Номер счёта / IBAN
                </div>
                <div className="text-base font-mono text-sm">
                  {organizationBank.account}
                </div>
              </div>
              {organizationBank.bic && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    БИК / BIC
                  </div>
                  <div className="text-base font-mono text-sm">
                    {organizationBank.bic}
                  </div>
                </div>
              )}
              {organizationBank.corrAccount && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Корр. счёт
                  </div>
                  <div className="text-base font-mono text-sm">
                    {organizationBank.corrAccount}
                  </div>
                </div>
              )}
              {organizationBank.swiftCode && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    SWIFT
                  </div>
                  <div className="text-base font-mono text-sm">
                    {organizationBank.swiftCode}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {contract && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-muted-foreground" />
                  Договор
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Номер договора
                  </div>
                  <div className="text-base">{contract.contractNumber}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Дата договора
                  </div>
                  <div className="text-base">{contract.contractDate}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Диалог редактирования дат */}
      <Dialog
        open={isEditingDates}
        onOpenChange={(open) => {
          if (!open) handleCancelEditDates();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Изменить даты сделки</DialogTitle>
            <DialogDescription>
              Укажите дату создания и дату закрытия сделки
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Дата создания</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !datesForm.createdAt && "text-muted-foreground",
                          )}
                          disabled={isSavingDates}
                        />
                      }
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {datesForm.createdAt
                        ? formatFns(datesForm.createdAt, "dd.MM.yyyy HH:mm", {
                            locale: ru,
                          })
                        : "Выберите дату"}
                    </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={datesForm.createdAt}
                      onSelect={(day) => {
                        if (!day) return;
                        const prev = datesForm.createdAt;
                        const updated = prev
                          ? setMinutes(
                              setHours(day, prev.getHours()),
                              prev.getMinutes(),
                            )
                          : day;
                        setDatesForm({ ...datesForm, createdAt: updated });
                      }}
                      initialFocus
                    />
                    <div className="border-t px-3 py-2 flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Время:
                      </Label>
                      <Input
                        type="time"
                        className="w-[100px] h-8 text-sm"
                        value={
                          datesForm.createdAt
                            ? formatFns(datesForm.createdAt, "HH:mm")
                            : ""
                        }
                        onChange={(e) => {
                          if (!datesForm.createdAt) return;
                          const [h, m] = e.target.value.split(":").map(Number);
                          setDatesForm({
                            ...datesForm,
                            createdAt: setMinutes(
                              setHours(datesForm.createdAt, h ?? 0),
                              m ?? 0,
                            ),
                          });
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Дата закрытия</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !datesForm.closedAt && "text-muted-foreground",
                          )}
                          disabled={isSavingDates}
                        />
                      }
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {datesForm.closedAt
                        ? formatFns(datesForm.closedAt, "dd.MM.yyyy HH:mm", {
                            locale: ru,
                          })
                        : "Не указана"}
                    </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={datesForm.closedAt}
                      onSelect={(day) => {
                        if (!day) {
                          setDatesForm({ ...datesForm, closedAt: undefined });
                          return;
                        }
                        const prev = datesForm.closedAt;
                        const updated = prev
                          ? setMinutes(
                              setHours(day, prev.getHours()),
                              prev.getMinutes(),
                            )
                          : day;
                        setDatesForm({ ...datesForm, closedAt: updated });
                      }}
                      initialFocus
                    />
                    <div className="border-t px-3 py-2 flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Время:
                      </Label>
                      <Input
                        type="time"
                        className="w-[100px] h-8 text-sm"
                        value={
                          datesForm.closedAt
                            ? formatFns(datesForm.closedAt, "HH:mm")
                            : ""
                        }
                        onChange={(e) => {
                          if (!datesForm.closedAt) return;
                          const [h, m] = e.target.value.split(":").map(Number);
                          setDatesForm({
                            ...datesForm,
                            closedAt: setMinutes(
                              setHours(datesForm.closedAt, h ?? 0),
                              m ?? 0,
                            ),
                          });
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {datesForm.closedAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() =>
                      setDatesForm({ ...datesForm, closedAt: undefined })
                    }
                    disabled={isSavingDates}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelEditDates}
              disabled={isSavingDates}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveDates} disabled={isSavingDates}>
              {isSavingDates ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог закрытия сделки */}
      <Dialog
        open={isCloseDealDialogOpen}
        onOpenChange={setIsCloseDealDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Закрыть сделку</DialogTitle>
            <DialogDescription>
              Введите себестоимость для завершения сделки. Агентский бонус будет
              рассчитан автоматически.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="costPrice">
                Себестоимость ({calculation.baseCurrencyCode || "RUB"})
              </Label>
              <Input
                id="costPrice"
                type="text"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="100 000"
                disabled={isClosingDeal}
              />
              <p className="text-xs text-muted-foreground">
                Итого с расходами ({calculation.baseCurrencyCode || "RUB"}):{" "}
                {formatCurrency(calculation.totalWithExpensesInBase)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCloseDealDialogOpen(false);
                setCostPrice("");
              }}
              disabled={isClosingDeal}
            >
              Отмена
            </Button>
            <Button onClick={handleCloseDeal} disabled={isClosingDeal}>
              {isClosingDeal ? "Закрытие..." : "Закрыть сделку"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog для подтверждения отмены сделки */}
      <AlertDialog open={cancelDealDialog} onOpenChange={setCancelDealDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить сделку?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить эту сделку? Это действие нельзя
              будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelDealDialog(false)}>
              Нет, вернуться
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCancelDealDialog(false);
                handleStatusUpdate("cancelled");
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Да, отменить сделку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog для отображения ошибок */}
      <AlertDialog
        open={errorDialog.isOpen}
        onOpenChange={(isOpen) => setErrorDialog({ ...errorDialog, isOpen })}
      >
        <AlertDialogContent>
          <div className="w-full min-w-0 py-4 space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
              <AlertDialogDescription className="truncate overflow-hidden text-ellipsis">
                {errorDialog.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() =>
                  setErrorDialog({ isOpen: false, title: "", message: "" })
                }
              >
                Понятно
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
