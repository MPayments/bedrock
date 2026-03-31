"use client";

import { Briefcase, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { NewDealDialog } from "@/components/portal/new-application-dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import { API_BASE_URL } from "@/lib/constants";

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

interface DealItem {
  id: string;
  counterpartyId: string | null;
  createdAt: string;
  organizationName: string | null;
  requestedAmount: string | null;
  requestedCurrencyCode: string | null;
  calculation: {
    originalAmount: string;
    currencyCode: string;
    totalWithExpensesInBase: string;
    baseCurrencyCode: string;
  } | null;
  status: DealStatus;
}

interface DealsResponse {
  data: DealItem[];
  total: number;
}

const STATUS_CONFIG: Record<DealStatus, { label: string; className: string }> = {
  draft: {
    label: "Черновик",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  },
  submitted: {
    label: "Отправлена",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  rejected: {
    label: "Отклонена",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
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
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  },
  closing_documents: {
    label: "Закрытие документов",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  done: {
    label: "Завершена",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
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

function formatCurrency(value: number | string, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))} ${symbol}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PortalDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const limit = 10;

  const fetchDeals = useCallback(async (currentPage: number) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          offset: ((currentPage - 1) * limit).toString(),
          limit: limit.toString(),
        });

        const response = await fetch(
          `${API_BASE_URL}/customer/deals?${params.toString()}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const data: DealsResponse = await response.json();
        setDeals(data.data ?? []);
        setTotalItems(data.total ?? 0);
        setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / limit)));
      } catch (fetchError) {
        console.error("Error fetching deals:", fetchError);
        setError(
          fetchError instanceof Error ? fetchError.message : "Ошибка загрузки сделок",
        );
      } finally {
        setLoading(false);
      }
    }, [limit]);

  useEffect(() => {
    void fetchDeals(page);
  }, [fetchDeals, page]);

  function renderDealAmount(deal: DealItem) {
    if (deal.calculation) {
      return {
        amount: formatCurrency(
          deal.calculation.originalAmount,
          deal.calculation.currencyCode,
        ),
        summary:
          deal.calculation.currencyCode !== deal.calculation.baseCurrencyCode
            ? formatCurrency(
                deal.calculation.totalWithExpensesInBase,
                deal.calculation.baseCurrencyCode,
              )
            : null,
      };
    }

    if (deal.requestedAmount && deal.requestedCurrencyCode) {
      return {
        amount: formatCurrency(deal.requestedAmount, deal.requestedCurrencyCode),
        summary: null,
      };
    }

    return {
      amount: "Сумма уточняется",
      summary: null,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Мои сделки</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalItems}{" "}
              {totalItems === 1 ? "сделка" : totalItems < 5 ? "сделки" : "сделок"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Создать сделку</span>
          <span className="sm:hidden">Создать</span>
        </Button>
      </div>

      <NewDealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setPage(1);
          void fetchDeals(1);
        }}
      />

      {error ? (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading && deals.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!loading && deals.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Сделок пока нет</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && deals.length > 0 ? (
        <div className="space-y-3">
          {deals.map((deal) => {
            const status = STATUS_CONFIG[deal.status];
            const amounts = renderDealAmount(deal);

            return (
              <Card
                key={deal.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/deals/${deal.id}`)}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">#{deal.id}</span>
                      <span>•</span>
                      <span>{formatDate(deal.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="mb-2 text-sm font-medium">
                    {deal.organizationName ?? "Организация не указана"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{amounts.amount}</span>
                    {amounts.summary ? (
                      <>
                        <span>≈</span>
                        <span>{amounts.summary}</span>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
          >
            Далее
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
