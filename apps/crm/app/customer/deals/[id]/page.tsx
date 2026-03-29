"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  FileText,
  Download,
  FileDown,
  Eye,
  Building2,
  Calendar,
  CreditCard,
  Briefcase,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/constants";

type DealStatus =
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

interface Client {
  id: number;
  orgName: string;
  orgType: string | null;
  directorName: string | null;
  position: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  bankName: string | null;
  account: string | null;
  bic: string | null;
  corrAccount: string | null;
}

interface Deal {
  id: number;
  applicationId: number;
  status: DealStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  client: Client | null;
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

interface DealDetailResponse {
  deal: Deal;
  calculation: Calculation | null;
}

const STATUS_CONFIG: Record<
  DealStatus,
  { label: string; className: string }
> = {
  preparing_documents: {
    label: "Подготовка документов",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  awaiting_funds: {
    label: "Ожидание средств",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  awaiting_payment: {
    label: "Ожидание оплаты",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  },
  closing_documents: {
    label: "Закрытие документов",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  done: {
    label: "Завершена",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  cancelled: {
    label: "Отменена",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  RUB: "₽",
  CNY: "¥",
  TRY: "₺",
  AED: "د.إ",
};

function formatCurrency(value: string | number, currency?: string): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  const symbol = CURRENCY_SYMBOLS[currency?.toUpperCase() || "RUB"] || currency || "₽";
  try {
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
    return `${formatted} ${symbol}`;
  } catch {
    return `${numValue.toFixed(2)} ${symbol}`;
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default function CustomerDealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = params?.id as string;

  const [data, setData] = useState<DealDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalculationDialog, setShowCalculationDialog] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/customer/deals/${dealId}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.push("/login/customer");
            return;
          }
          if (response.status === 404) {
            throw new Error("Сделка не найдена");
          }
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const result: DealDetailResponse = await response.json();
        setData(result);
      } catch (err) {
        console.error("Deal fetch error:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }

    if (dealId) {
      fetchData();
    }
  }, [dealId, router]);

  const handleDownloadCalculation = async (
    calculationId: number,
    format: "pdf" | "docx"
  ) => {
    try {
      const url = `${API_BASE_URL}/documents/calculations/${calculationId}/export?format=${format}`;
      const res = await fetch(url, { credentials: "include" });

      if (!res.ok) {
        throw new Error("Ошибка загрузки документа");
      }

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `Расчет_${calculationId}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i
        );
        if (filenameMatch?.[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
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
      console.error("Download error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" /> Назад
        </Button>
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-destructive">{error || "Не удалось загрузить данные"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { deal, calculation } = data;
  const statusConfig = STATUS_CONFIG[deal.status];

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Сделка #{deal.id}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            от {formatDate(deal.createdAt)}
          </p>
        </div>
      </div>

      {/* Summary Card - Amount */}
      {calculation && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground mb-1">Сумма сделки</div>
            <div className="text-2xl font-bold">
              {formatCurrency(calculation.originalAmount, calculation.currencyCode)}
            </div>
            {calculation.currencyCode !== calculation.baseCurrencyCode && (
              <div className="text-sm text-muted-foreground mt-1">
                ≈ {formatCurrency(calculation.totalWithExpensesInBase, calculation.baseCurrencyCode)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Info */}
      {deal.client && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Клиент
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="font-medium">{deal.client.orgName}</div>
              {deal.client.orgType && (
                <div className="text-sm text-muted-foreground">
                  {deal.client.orgType}
                </div>
              )}
            </div>

            {deal.client.inn && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ИНН</span>
                <span className="font-mono">{deal.client.inn}</span>
              </div>
            )}

            {deal.client.kpp && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">КПП</span>
                <span className="font-mono">{deal.client.kpp}</span>
              </div>
            )}

            {deal.client.directorName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Руководитель</span>
                <span>{deal.client.directorName}</span>
              </div>
            )}

            {deal.client.phone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Телефон</span>
                <span>{deal.client.phone}</span>
              </div>
            )}

            {deal.client.email && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span>{deal.client.email}</span>
              </div>
            )}

            {deal.client.address && (
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">Адрес</div>
                <div className="text-sm">{deal.client.address}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bank Details */}
      {deal.client?.bankName && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Банковские реквизиты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm font-medium">{deal.client.bankName}</div>

            {deal.client.account && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Р/с</span>
                <span className="font-mono text-xs">{deal.client.account}</span>
              </div>
            )}

            {deal.client.bic && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">БИК</span>
                <span className="font-mono">{deal.client.bic}</span>
              </div>
            )}

            {deal.client.corrAccount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">К/с</span>
                <span className="font-mono text-xs">{deal.client.corrAccount}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deal Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Информация о сделке
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Создана</span>
            <span>{formatDateTime(deal.createdAt)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Обновлена</span>
            <span>{formatDateTime(deal.updatedAt)}</span>
          </div>

          {deal.closedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Закрыта</span>
              <span>{formatDateTime(deal.closedAt)}</span>
            </div>
          )}

          {deal.comment && (
            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground mb-1">Комментарий</div>
              <div className="text-sm">{deal.comment}</div>
            </div>
          )}

          {/* Link to Application */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => router.push(`/customer/applications/${deal.applicationId}`)}
            >
              <LinkIcon className="h-4 w-4" />
              Перейти к заявке #{deal.applicationId}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calculation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Расчёт
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!calculation ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm">Расчёт отсутствует</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(calculation.originalAmount, calculation.currencyCode)}
                    </span>
                    {calculation.status === "active" && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        Актуальный
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(calculation.createdAt)} • Курс: {parseFloat(calculation.rate).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowCalculationDialog(true)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDownloadCalculation(calculation.id, "pdf")}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDownloadCalculation(calculation.id, "docx")}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Word
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calculation Detail Dialog */}
      {calculation && (
        <Dialog open={showCalculationDialog} onOpenChange={setShowCalculationDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Детали расчёта</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Валюта</div>
                  <div className="font-medium">{calculation.currencyCode}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Курс</div>
                  <div className="font-medium">
                    {parseFloat(calculation.rate).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Сумма</div>
                  <div className="font-medium">
                    {formatCurrency(calculation.originalAmount, calculation.currencyCode)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Комиссия</div>
                  <div className="font-medium">
                    {calculation.feePercentage}%
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сумма комиссии</span>
                  <span>
                    {formatCurrency(calculation.feeAmount, calculation.currencyCode)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Итого (валюта)</span>
                  <span>
                    {formatCurrency(calculation.totalAmount, calculation.currencyCode)}
                  </span>
                </div>
                {parseFloat(calculation.additionalExpenses) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Доп. расходы</span>
                    <span>
                      {formatCurrency(
                        calculation.additionalExpenses,
                        calculation.additionalExpensesCurrencyCode || "RUB"
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Итого к оплате</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(calculation.totalWithExpensesInBase, calculation.baseCurrencyCode)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDownloadCalculation(calculation.id, "pdf")}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDownloadCalculation(calculation.id, "docx")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Word
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
