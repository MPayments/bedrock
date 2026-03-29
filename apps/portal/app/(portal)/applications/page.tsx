"use client";

import { ChevronLeft, ChevronRight, FileText, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { NewApplicationDialog } from "@/components/portal/new-application-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/constants";

type ApplicationStatus = "forming" | "created" | "rejected" | "finished";

interface ApplicationItem {
  id: number;
  createdAt: string;
  client: string;
  amount: number;
  currency: string;
  amountInBase: number;
  baseCurrencyCode: string;
  status: ApplicationStatus;
  hasCalculation: boolean;
}

interface ApplicationsResponse {
  data: ApplicationItem[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  forming: {
    label: "Формируется",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  created: {
    label: "Создана",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
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

function formatCurrency(value: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${symbol}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PortalApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const limit = 10;

  async function fetchApplications(currentPage: number) {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        offset: ((currentPage - 1) * limit).toString(),
        limit: limit.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/customer/applications?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const data: ApplicationsResponse = await response.json();
      setApplications(data.data ?? []);
      setTotalItems(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / limit)));
    } catch (fetchError) {
      console.error("Error fetching applications:", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Ошибка загрузки заявок",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchApplications(page);
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Мои заявки</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalItems}{" "}
              {totalItems === 1
                ? "заявка"
                : totalItems < 5
                  ? "заявки"
                  : "заявок"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Создать заявку</span>
          <span className="sm:hidden">Создать</span>
        </Button>
      </div>

      <NewApplicationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setPage(1);
          void fetchApplications(1);
        }}
      />

      {error ? (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading && applications.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!loading && applications.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Заявок пока нет</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && applications.length > 0 ? (
        <div className="space-y-3">
          {applications.map((application) => {
            const status = STATUS_CONFIG[application.status];

            return (
              <Card
                key={application.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/applications/${application.id}`)}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        #{application.id}
                      </span>
                      <span>•</span>
                      <span>{formatDate(application.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="mb-2 text-sm font-medium">{application.client}</p>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatCurrency(application.amount, application.currency)}</span>
                    {application.currency !== application.baseCurrencyCode ? (
                      <>
                        <span>≈</span>
                        <span>
                          {formatCurrency(
                            application.amountInBase,
                            application.baseCurrencyCode,
                          )}
                        </span>
                      </>
                    ) : null}
                    {application.hasCalculation ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        Есть расчет
                      </span>
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
