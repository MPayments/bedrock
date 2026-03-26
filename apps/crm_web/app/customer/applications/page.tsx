"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/constants";
import { NewApplicationDialog } from "@/components/customer/NewApplicationDialog";

type ApplicationStatus = "forming" | "created" | "rejected" | "finished";

interface ApplicationItem {
  id: number;
  createdAt: string;
  client: string;
  clientId: number;
  amount: number;
  currency: string;
  amountInBase: number;
  baseCurrencyCode: string;
  hasCalculation: boolean;
  comment?: string;
  status: ApplicationStatus;
}

interface ApplicationsResponse {
  items: ApplicationItem[];
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  forming: {
    label: "Формируется",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  created: {
    label: "Создана",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  rejected: {
    label: "Отклонена",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  finished: {
    label: "Завершена",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
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

export default function CustomerApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const limit = 10;

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/customer/applications?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push("/login/customer");
          return;
        }
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const data: ApplicationsResponse = await response.json();
      setApplications(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки заявок");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, router]);

  const handleApplicationCreated = () => {
    // Refresh the list after creating a new application
    setPage(1);
    fetchApplications();
  };

  if (loading && applications.length === 0) {
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
          <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Мои заявки
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalItems}{" "}
              {totalItems === 1
                ? "заявка"
                : totalItems < 5
                ? "заявки"
                : "заявок"}
            </p>
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Создать заявку</span>
          <span className="sm:hidden">Создать</span>
        </Button>
      </div>

      {/* New Application Dialog */}
      <NewApplicationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={handleApplicationCreated}
      />

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading overlay */}
      {loading && applications.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && applications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Заявок пока нет</p>
            <p className="text-sm text-muted-foreground mt-1">
              Заявки по вашим организациям появятся здесь
            </p>
          </CardContent>
        </Card>
      )}

      {/* Applications list */}
      {!loading && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((app) => {
            const statusConfig = STATUS_CONFIG[app.status];

            return (
              <Card
                key={app.id}
                className="hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/customer/applications/${app.id}`)}
              >
                <CardContent className="p-4">
                  {/* Top row: ID, date, and status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        #{app.id}
                      </span>
                      <span>•</span>
                      <span>{formatDate(app.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Client name */}
                  <p className="font-medium text-sm truncate mb-2">
                    {app.client}
                  </p>

                  {/* Amount */}
                  <div className="flex items-baseline gap-2">
                    {app.hasCalculation && app.amount > 0 ? (
                      <>
                        <span className="text-lg font-semibold">
                          {formatCurrency(app.amount, app.currency)}
                        </span>
                        {app.currency !== app.baseCurrencyCode && app.amountInBase > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ≈ {formatCurrency(app.amountInBase, app.baseCurrencyCode)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Расчёт отсутствует
                      </span>
                    )}
                  </div>

                  {/* Comment if exists */}
                  {app.comment && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {app.comment}
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
