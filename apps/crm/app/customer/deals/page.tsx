"use client";

import { useState, useEffect } from "react";
import { Briefcase, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/constants";

type DealStatus =
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

interface DealItem {
  id: number;
  applicationId: number;
  createdAt: string;
  closedAt: string | null;
  client: string;
  clientId: number;
  amount: number;
  currency: string;
  amountInBase: number;
  baseCurrencyCode: string;
  status: DealStatus;
  comment?: string;
}

interface DealsResponse {
  data: DealItem[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_CONFIG: Record<DealStatus, { label: string; className: string }> =
  {
    preparing_documents: {
      label: "Подготовка документов",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    },
    awaiting_funds: {
      label: "Ожидание средств",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    },
    awaiting_payment: {
      label: "Ожидание оплаты",
      className:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    },
    closing_documents: {
      label: "Закрытие документов",
      className:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
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

function formatCurrency(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  try {
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${formatted} ${symbol}`;
  } catch {
    return `${value.toFixed(2)} ${symbol}`;
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

export default function CustomerDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const limit = 10;

  useEffect(() => {
    async function fetchDeals() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          offset: ((page - 1) * limit).toString(),
          limit: limit.toString(),
        });

        const response = await fetch(
          `${API_BASE_URL}/customer/deals?${params.toString()}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.push("/login/customer");
            return;
          }
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const data: DealsResponse = await response.json();
        setDeals(data.data ?? []);
        setTotalPages(Math.ceil((data.total ?? 0) / limit));
        setTotalItems(data.total ?? 0);
      } catch (err) {
        console.error("Error fetching deals:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки сделок");
      } finally {
        setLoading(false);
      }
    }

    fetchDeals();
  }, [page, router]);

  if (loading && deals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Мои сделки
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalItems}{" "}
              {totalItems === 1
                ? "сделка"
                : totalItems < 5
                ? "сделки"
                : "сделок"}
            </p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading overlay */}
      {loading && deals.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && deals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Сделок пока нет</p>
            <p className="text-sm text-muted-foreground mt-1">
              Сделки по вашим организациям появятся здесь
            </p>
          </CardContent>
        </Card>
      )}

      {/* Deals list */}
      {!loading && deals.length > 0 && (
        <div className="space-y-3">
          {deals.map((deal) => {
            const statusConfig = STATUS_CONFIG[deal.status];

            return (
              <Card
                key={deal.id}
                className="hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/customer/deals/${deal.id}`)}
              >
                <CardContent className="p-4">
                  {/* Top row: ID, date, and status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        #{deal.id}
                      </span>
                      <span>•</span>
                      <span>{formatDate(deal.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Client name */}
                  <p className="font-medium text-sm truncate mb-2">
                    {deal.client}
                  </p>

                  {/* Amount */}
                  <div className="flex items-baseline gap-2">
                    {deal.amount > 0 ? (
                      <>
                        <span className="text-lg font-semibold">
                          {formatCurrency(deal.amount, deal.currency)}
                        </span>
                        {deal.currency !== deal.baseCurrencyCode && deal.amountInBase > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ≈ {formatCurrency(deal.amountInBase, deal.baseCurrencyCode)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Сумма не указана
                      </span>
                    )}
                  </div>

                  {/* Closed date if done */}
                  {deal.status === "done" && deal.closedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Закрыта: {formatDate(deal.closedAt)}
                    </p>
                  )}

                  {/* Comment if exists */}
                  {deal.comment && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {deal.comment}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
