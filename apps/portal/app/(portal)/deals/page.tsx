"use client";

import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { NewDealDialog } from "@/components/portal/new-application-dialog";
import {
  type PortalCustomerContext,
  requestPortalCustomers,
} from "@/lib/api/customers";
import {
  type PortalDealListItemProjection,
  type PortalDealStatus,
  type PortalDealType,
  requestPortalDealProjections,
} from "@/lib/api/deals";

function hasActiveAgentAgreement(customer: PortalCustomerContext) {
  return customer.agentAgreement.status === "active";
}

const STATUS_CONFIG: Record<
  PortalDealStatus,
  { label: string; className: string }
> =
  {
    draft: {
      label: "Черновик",
      className:
        "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    },
    submitted: {
      label: "Отправлена",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    },
    rejected: {
      label: "Отклонена",
      className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    },
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
const TYPE_CONFIG: Record<
  PortalDealType,
  { label: string; className: string }
> = {
  payment: {
    label: "Платеж",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  },
  currency_exchange: {
    label: "Обмен валюты",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  currency_transit: {
    label: "Валютный транзит",
    className:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  exporter_settlement: {
    label: "Экспортерское финансирование",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PortalDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<PortalDealListItemProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerContexts, setCustomerContexts] = useState<
    PortalCustomerContext[]
  >([]);
  const [loadingCustomerContexts, setLoadingCustomerContexts] = useState(true);
  const [customerContextsError, setCustomerContextsError] = useState<
    string | null
  >(null);
  const [agreementAlertDismissed, setAgreementAlertDismissed] = useState(false);

  const limit = 10;

  const fetchDeals = useCallback(
    async (currentPage: number) => {
      try {
        setLoading(true);
        setError(null);
        const data = await requestPortalDealProjections({
          limit,
          offset: (currentPage - 1) * limit,
        });
        setDeals(data.data ?? []);
        setTotalItems(data.total ?? 0);
        setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / limit)));
      } catch (fetchError) {
        console.error("Error fetching deals:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Ошибка загрузки сделок",
        );
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  const fetchCustomerContexts = useCallback(async () => {
    try {
      setLoadingCustomerContexts(true);
      setCustomerContextsError(null);
      const data = await requestPortalCustomers();
      setCustomerContexts(data.data ?? []);
    } catch (fetchError) {
      console.error("Error fetching customer contexts:", fetchError);
      setCustomerContextsError(
        "Не удалось проверить статус агентского договора",
      );
    } finally {
      setLoadingCustomerContexts(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeals(page);
  }, [fetchDeals, page]);

  useEffect(() => {
    void fetchCustomerContexts();
  }, [fetchCustomerContexts]);

  const canCreateDeal = customerContexts.some(hasActiveAgentAgreement);
  const dealCreationDisabled = loadingCustomerContexts || !canCreateDeal;
  const showMissingAgreementAlert =
    !loadingCustomerContexts &&
    !customerContextsError &&
    !canCreateDeal &&
    !agreementAlertDismissed;

  useEffect(() => {
    if (canCreateDeal) {
      setAgreementAlertDismissed(false);
    }
  }, [canCreateDeal]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Мои сделки</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalItems}{" "}
              {totalItems === 1
                ? "сделка"
                : totalItems < 5
                  ? "сделки"
                  : "сделок"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={dealCreationDisabled}
        >
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Создать сделку</span>
          <span className="sm:hidden">Создать</span>
        </Button>
      </div>

      {customerContextsError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Не удалось проверить статус агентского договора.
          </AlertDescription>
        </Alert>
      ) : null}

      {showMissingAgreementAlert ? (
        <Alert variant="warning" className="pr-12">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Заключите агентский договор, чтобы создавать сделки.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            onClick={() => setAgreementAlertDismissed(true)}
            aria-label="Закрыть уведомление"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ) : null}

      <NewDealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerContexts={customerContexts}
        onSuccess={() => {
          setPage(1);
          void fetchDeals(1);
          void fetchCustomerContexts();
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
            const type = TYPE_CONFIG[deal.type];

            return (
              <Card
                key={deal.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/deals/${deal.id}`)}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        #{formatCompactId(deal.id)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(deal.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${type.className}`}
                      >
                        {type.label}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {deal.applicantDisplayName ?? "Организация не указана"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                          deal.submissionComplete
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                        }`}
                      >
                        {deal.submissionComplete
                          ? "Заявка заполнена"
                          : "Нужно дополнить"}
                      </span>
                      <span className="text-muted-foreground">
                        Вложений: {deal.attachmentCount}
                      </span>
                      {deal.quoteExpiresAt ? (
                        <span className="text-muted-foreground">
                          Котировка до {formatDate(deal.quoteExpiresAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Следующее действие: {deal.nextAction}
                    </p>
                    {deal.calculationSummary ? (
                      <p className="text-xs text-muted-foreground">
                        Расчет привязан
                      </p>
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
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
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
