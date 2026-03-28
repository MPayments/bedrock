"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Plus,
  Download,
  FileText,
  FileDown,
  Eye,
  Trash2,
  XCircle,
  CheckCircle,
  Edit,
  Save,
  X,
  UserPlus,
  Loader2,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";
import { useSession } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewCalculationDialog } from "@/components/dashboard/NewCalculationDialog";
import { ViewCalculationDialog } from "@/components/dashboard/ViewCalculationDialog";
import { RejectApplicationDialog } from "@/components/dashboard/RejectApplicationDialog";
import { CreateDealDialog } from "@/components/dashboard/CreateDealDialog";
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
import { Textarea } from "@/components/ui/textarea";

type CurrencyCode = "USD" | "EUR" | "RUB";

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

interface Application {
  id: number;
  agentId: string | null;
  clientId: number;
  status: "forming" | "created" | "rejected" | "finished";
  reason: string | null;
  comment: string | null;
  requestedAmount: string | null;
  requestedCurrency: string | null;
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

const STATUS_LABELS: Record<
  "forming" | "created" | "rejected" | "finished",
  string
> = {
  forming: "Формируется",
  created: "Создана",
  rejected: "Отклонена",
  finished: "Завершена",
};

const STATUS_COLORS: Record<
  "forming" | "created" | "rejected" | "finished",
  string
> = {
  forming: "bg-yellow-100 text-yellow-800",
  created: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  finished: "bg-green-100 text-green-800",
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

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [application, setApplication] = useState<Application | null>(null);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalculationDialog, setShowCalculationDialog] = useState(false);
  const [showViewCalculationDialog, setShowViewCalculationDialog] =
    useState(false);
  const [selectedCalculation, setSelectedCalculation] =
    useState<Calculation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [calculationToDelete, setCalculationToDelete] = useState<number | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isTakingApplication, setIsTakingApplication] = useState(false);

  const applicationId = params?.id as string;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Заявка не найдена");
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const app: Application = await res.json();
      setApplication(app);

      // Fetch client details
      try {
        const clientRes = await fetch(`${API_BASE_URL}/clients/${app.clientId}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (clientRes.ok) {
          setClient(await clientRes.json());
        }
      } catch {
        // Client details are optional
      }

      // Fetch calculations for this application
      try {
        const calcRes = await fetch(
          `${API_BASE_URL}/calculations?applicationId=${app.id}`,
          { cache: "no-store", credentials: "include" },
        );
        if (calcRes.ok) {
          const calcData = await calcRes.json();
          setCalculations(Array.isArray(calcData) ? calcData : calcData.data ?? []);
        }
      } catch {
        // Calculations are optional
      }
    } catch (err) {
      console.error("Application fetch error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) {
      fetchData();
    }
  }, [applicationId]);

  const handleCalculationSuccess = () => {
    // Перезагружаем данные после успешного создания расчёта
    fetchData();
  };

  const handleViewCalculation = (calculation: Calculation) => {
    setSelectedCalculation(calculation);
    setShowViewCalculationDialog(true);
  };

  const handleDeleteCalculation = (calculationId: number) => {
    setCalculationToDelete(calculationId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCalculation = async () => {
    if (!calculationToDelete) return;

    try {
      const url = `${API_BASE_URL}/applications/${applicationId}/calculations/${calculationToDelete}`;
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка удаления расчёта");
      }

      // Успешно удалено - обновляем данные
      setShowDeleteConfirm(false);
      setCalculationToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Не удалось удалить расчёт"
      );
      setShowDeleteConfirm(false);
      setCalculationToDelete(null);
    }
  };

  const handleDownloadCalculation = async (
    calculationId: number,
    format: "pdf" | "docx"
  ) => {
    try {
      const url = `${API_BASE_URL}/documents/calculations/${calculationId}/export?format=${format}`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Ошибка загрузки документа");
      }

      // Получаем имя файла из заголовка Content-Disposition
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

      // Скачиваем файл
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
      setErrorMessage(
        err instanceof Error ? err.message : "Не удалось скачать документ"
      );
    }
  };

  const handleEditComment = () => {
    setCommentValue(application?.comment || "");
    setIsEditingComment(true);
  };

  const handleCancelEditComment = () => {
    setIsEditingComment(false);
    setCommentValue("");
  };

  const handleSaveComment = async () => {
    try {
      setIsSavingComment(true);
      const res = await fetch(
        `${API_BASE_URL}/applications/${applicationId}/comment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ comment: commentValue }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Ошибка обновления комментария");
      }

      // Успешно сохранено - обновляем данные
      setIsEditingComment(false);
      fetchData();
    } catch (err) {
      console.error("Save comment error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Не удалось сохранить комментарий"
      );
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleTakeApplication = async () => {
    try {
      setIsTakingApplication(true);
      const res = await fetch(
        `${API_BASE_URL}/applications/${applicationId}/take`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Ошибка взятия заявки");
      }

      // Успешно взяли заявку - обновляем данные
      fetchData();
    } catch (err) {
      console.error("Take application error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Не удалось взять заявку"
      );
    } finally {
      setIsTakingApplication(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (error || !application) {
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

  return (
    <div className="space-y-4">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Заявка #{application.id}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLORS[application.status]
            }`}
          >
            {STATUS_LABELS[application.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Кнопка "Взять заявку" если агент не назначен */}
          {application.agentId === null && (
            <Button
              variant="default"
              size="sm"
              onClick={handleTakeApplication}
              disabled={isTakingApplication}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isTakingApplication ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Взять заявку
            </Button>
          )}
          {/* Остальные кнопки доступны только если заявка назначена на агента */}
          {application.agentId !== null && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowCalculationDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Новый расчёт
              </Button>
              {application.status !== "rejected" &&
                application.status !== "finished" && (
                  <>
                    {calculations.length > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowCreateDealDialog(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" /> Создать сделку
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectDialog(true)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Отклонить
                    </Button>
                  </>
                )}
            </>
          )}
        </div>
      </div>

      {/* Диалог создания расчёта */}
      <NewCalculationDialog
        open={showCalculationDialog}
        onOpenChange={setShowCalculationDialog}
        applicationId={parseInt(applicationId)}
        onSuccess={handleCalculationSuccess}
      />

      {/* Диалог просмотра расчёта */}
      <ViewCalculationDialog
        open={showViewCalculationDialog}
        onOpenChange={setShowViewCalculationDialog}
        calculation={selectedCalculation}
      />

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить расчёт?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот расчёт? Это действие
              необратимо и не может быть отменено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCalculation}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог ошибки */}
      <AlertDialog
        open={!!errorMessage}
        onOpenChange={() => setErrorMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ошибка</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)}>
              Закрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог отклонения заявки */}
      <RejectApplicationDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        applicationId={parseInt(applicationId)}
        onSuccess={fetchData}
      />

      {/* Диалог создания сделки */}
      <CreateDealDialog
        open={showCreateDealDialog}
        onOpenChange={setShowCreateDealDialog}
        applicationId={parseInt(applicationId)}
        calculations={calculations}
        onSuccess={fetchData}
      />

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка - Карточка заявки */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация о заявке</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Номер заявки
                  </div>
                  <div className="text-base">#{application.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Статус
                  </div>
                  <div className="text-base">
                    {STATUS_LABELS[application.status]}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Дата создания
                  </div>
                  <div className="text-base">
                    {formatDate(application.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Последнее обновление
                  </div>
                  <div className="text-base">
                    {formatDate(application.updatedAt)}
                  </div>
                </div>
                {isAdmin && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Агент
                    </div>
                    <div className="text-base">
                      {application.agentId ? (
                        `Агент #${application.agentId}`
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                          Не назначен
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {application.requestedAmount &&
                  application.requestedCurrency && (
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        Запрос клиента
                      </div>
                      <div className="text-base font-semibold text-primary">
                        {formatCurrency(
                          application.requestedAmount,
                          application.requestedCurrency
                        )}
                      </div>
                    </div>
                  )}
                {application.reason && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Причина / Комментарий
                    </div>
                    <div className="text-base">{application.reason}</div>
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
                      {application.comment ? "Редактировать" : "Добавить"}
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
                    {application.comment || (
                      <span className="text-muted-foreground italic">
                        Комментарий отсутствует
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Список расчётов */}
          <Card>
            <CardHeader>
              <CardTitle>Расчёты ({calculations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {calculations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Расчёты отсутствуют
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Валюта</TableHead>
                        <TableHead className="text-right">
                          Сумма (валюта)
                        </TableHead>
                        <TableHead className="text-right">Курс</TableHead>
                        <TableHead className="text-right">Итого (баз.)</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right w-[120px]">
                          Действия
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculations.map((calc, idx) => (
                        <TableRow key={calc.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{formatDate(calc.createdAt)}</TableCell>
                          <TableCell>{calc.currencyCode}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              calc.originalAmount,
                              calc.currencyCode
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {parseFloat(calc.rate).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calc.totalWithExpensesInBase)}
                            {calc.baseCurrencyCode && calc.baseCurrencyCode !== "RUB" && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({calc.baseCurrencyCode})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                calc.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {calc.status === "active"
                                ? "Активный"
                                : calc.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleViewCalculation(calc)}
                                title="Просмотр"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Скачать"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDownloadCalculation(calc.id, "pdf")
                                    }
                                  >
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Скачать PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDownloadCalculation(calc.id, "docx")
                                    }
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Скачать Word
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteCalculation(calc.id)}
                                title="Удалить"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка - Информация о клиенте */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация о клиенте</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Название организации
                    </div>
                    <div className="text-base font-medium">
                      {client.orgName}
                    </div>
                  </div>
                  {client.orgType && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Тип организации
                      </div>
                      <div className="text-base">
                        {client.orgType}
                      </div>
                    </div>
                  )}
                  {client.directorName && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Руководитель
                      </div>
                      <div className="text-base">
                        {client.directorName}
                      </div>
                      {client.position && (
                        <div className="text-sm text-muted-foreground">
                          {client.position}
                        </div>
                      )}
                    </div>
                  )}
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
                  {client.ogrn && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        ОГРН
                      </div>
                      <div className="text-base">{client.ogrn}</div>
                    </div>
                  )}
                  {client.phone && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Телефон
                      </div>
                      <div className="text-base">
                        {client.phone}
                      </div>
                    </div>
                  )}
                  {client.email && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Email
                      </div>
                      <div className="text-base">
                        {client.email}
                      </div>
                    </div>
                  )}
                  {client.address && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Адрес
                      </div>
                      <div className="text-base">
                        {client.address}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Информация о клиенте недоступна
                </div>
              )}
            </CardContent>
          </Card>

          {client?.bankName && (
            <Card>
              <CardHeader>
                <CardTitle>Банковские реквизиты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Банк
                  </div>
                  <div className="text-base">{client.bankName}</div>
                </div>
                {client.account && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Расчётный счёт
                    </div>
                    <div className="text-base font-mono text-sm">
                      {client.account}
                    </div>
                  </div>
                )}
                {client.bic && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      БИК
                    </div>
                    <div className="text-base font-mono text-sm">
                      {client.bic}
                    </div>
                  </div>
                )}
                {client.corrAccount && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Корр. счёт
                    </div>
                    <div className="text-base font-mono text-sm">
                      {client.corrAccount}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
