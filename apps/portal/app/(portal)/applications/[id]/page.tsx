"use client";

import { Calendar, ChevronLeft, Download, Eye, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { API_BASE_URL } from "@/lib/constants";

type ApplicationStatus = "forming" | "created" | "rejected" | "finished";

interface Client {
  id: number;
  orgName: string;
  inn: string | null;
  directorName: string | null;
}

interface Application {
  id: number;
  clientId: number;
  status: ApplicationStatus;
  reason: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client | null;
}

interface Calculation {
  id: number;
  currencyCode: string;
  originalAmount: string;
  feePercentage: string;
  feeAmount: string;
  totalAmount: string;
  rate: string;
  baseCurrencyCode: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
  calculationTimestamp: string;
  status: string;
}

interface ApplicationDetailResponse {
  application: Application;
  calculations: Calculation[];
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  forming: "Формируется",
  created: "Создана",
  rejected: "Отклонена",
  finished: "Завершена",
};

function formatMoney(value: string, currency: string) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))} ${currency}`;
}

export default function PortalApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = Number(params.id);

  const [data, setData] = useState<ApplicationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalculation, setSelectedCalculation] = useState<Calculation | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `${API_BASE_URL}/customer/applications/${applicationId}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Заявка не найдена");
          }
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const result: ApplicationDetailResponse = await response.json();
        setData(result);
      } catch (fetchError) {
        console.error("Application fetch error:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Ошибка загрузки данных",
        );
      } finally {
        setLoading(false);
      }
    }

    if (Number.isFinite(applicationId)) {
      void fetchData();
    }
  }, [applicationId]);

  async function handleDownload(calculationId: number, format: "pdf" | "docx") {
    const response = await fetch(
      `${API_BASE_URL}/documents/calculations/${calculationId}/export?format=${format}`,
      {
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Ошибка загрузки документа");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calculation-${calculationId}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/applications")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error ?? "Данные не найдены"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/applications")}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Назад к заявкам
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Заявка #{data.application.id}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {STATUS_LABELS[data.application.status]}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Организация</p>
              <p className="text-sm font-medium">
                {data.application.client?.orgName ?? "Не указана"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Создана</p>
              <p className="text-sm font-medium">
                {new Date(data.application.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
            {data.application.comment ? (
              <div className="md:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">Комментарий</p>
                <p className="text-sm">{data.application.comment}</p>
              </div>
            ) : null}
            {data.application.reason ? (
              <div className="md:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">Причина</p>
                <p className="text-sm">{data.application.reason}</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Расчеты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.calculations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Расчетов пока нет.</p>
          ) : (
            data.calculations.map((calculation) => (
              <div
                key={calculation.id}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">Расчет #{calculation.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(
                        calculation.originalAmount,
                        calculation.currencyCode,
                      )}{" "}
                      • итого{" "}
                      {formatMoney(
                        calculation.totalWithExpensesInBase,
                        calculation.baseCurrencyCode,
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(calculation.calculationTimestamp).toLocaleString("ru-RU")}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="outline" size="sm" />}
                    >
                      <Download className="h-4 w-4" />
                      Действия
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedCalculation(calculation)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Просмотр
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDownload(calculation.id, "pdf")}
                      >
                        Скачать PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDownload(calculation.id, "docx")}
                      >
                        Скачать DOCX
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedCalculation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCalculation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCalculation ? `Расчет #${selectedCalculation.id}` : "Расчет"}
            </DialogTitle>
          </DialogHeader>
          {selectedCalculation ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Сумма</span>
                <span>
                  {formatMoney(
                    selectedCalculation.originalAmount,
                    selectedCalculation.currencyCode,
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Комиссия</span>
                <span>{selectedCalculation.feePercentage}%</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Курс</span>
                <span>{selectedCalculation.rate}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Итого</span>
                <span>
                  {formatMoney(
                    selectedCalculation.totalWithExpensesInBase,
                    selectedCalculation.baseCurrencyCode,
                  )}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
