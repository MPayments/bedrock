"use client";

import { ArrowLeftRight, Briefcase, ChevronLeft, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
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
  inn: string | null;
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
  id: string;
  currencyCode: string;
  originalAmount: string;
  totalAmount: string;
  baseCurrencyCode: string;
  totalWithExpensesInBase: string;
}

interface DealDetailResponse {
  deal: Deal;
  calculation: Calculation | null;
}

const STATUS_LABELS: Record<DealStatus, string> = {
  preparing_documents: "Подготовка документов",
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  closing_documents: "Закрытие документов",
  done: "Завершена",
  cancelled: "Отменена",
};

function formatMoney(value: string, currency: string) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))} ${currency}`;
}

export default function PortalDealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = Number(params.id);

  const [data, setData] = useState<DealDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/customer/deals/${dealId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Сделка не найдена");
          }
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const result: DealDetailResponse = await response.json();
        setData(result);
      } catch (fetchError) {
        console.error("Deal fetch error:", fetchError);
        setError(
          fetchError instanceof Error ? fetchError.message : "Ошибка загрузки данных",
        );
      } finally {
        setLoading(false);
      }
    }

    if (Number.isFinite(dealId)) {
      void fetchData();
    }
  }, [dealId]);

  async function handleDownload(format: "pdf" | "docx") {
    if (!data?.calculation) return;

    const response = await fetch(
      `${API_BASE_URL}/documents/calculations/${data.calculation.id}/export?format=${format}`,
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
    anchor.download = `deal-calculation-${data.calculation.id}.${format}`;
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
        <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
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
      <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Назад к сделкам
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Сделка #{data.deal.id}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {STATUS_LABELS[data.deal.status]}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Организация</p>
            <p className="text-sm font-medium">
              {data.deal.client?.orgName ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Создана</p>
            <p className="text-sm font-medium">
              {new Date(data.deal.createdAt).toLocaleString("ru-RU")}
            </p>
          </div>
          {data.deal.closedAt ? (
            <div>
              <p className="text-xs uppercase text-muted-foreground">Закрыта</p>
              <p className="text-sm font-medium">
                {new Date(data.deal.closedAt).toLocaleString("ru-RU")}
              </p>
            </div>
          ) : null}
          {data.deal.comment ? (
            <div className="md:col-span-2">
              <p className="text-xs uppercase text-muted-foreground">Комментарий</p>
              <p className="text-sm">{data.deal.comment}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Расчет сделки
            </span>
            {data.deal.applicationId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/applications/${data.deal.applicationId}`)}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                К заявке
              </Button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.calculation ? (
            <>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Сумма</span>
                <span>
                  {formatMoney(
                    data.calculation.originalAmount,
                    data.calculation.currencyCode,
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Итого</span>
                <span>
                  {formatMoney(
                    data.calculation.totalWithExpensesInBase,
                    data.calculation.baseCurrencyCode,
                  )}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => void handleDownload("pdf")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Скачать PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleDownload("docx")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Скачать DOCX
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Расчет пока не подготовлен.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
