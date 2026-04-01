import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DealWorkflowDialog } from "@/features/treasury/quotes/components/deal-workflow-dialog";
import {
  getFinanceDealQueues,
  type FinanceDealQueueFilters,
} from "@/features/treasury/deals/lib/queries";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const QUEUE_LABELS = {
  execution: "Исполнение",
  failed_instruction: "Сбои",
  funding: "Фондирование",
} as const;

const TYPE_LABELS: Record<string, string> = {
  currency_exchange: "Обмен",
  currency_transit: "Транзит",
  exporter_settlement: "Экспортер",
  payment: "Платеж",
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  cancelled: "Отменена",
  closing_documents: "Закрытие документов",
  done: "Завершена",
  draft: "Черновик",
  preparing_documents: "Подготовка документов",
  rejected: "Отклонена",
  submitted: "Отправлена",
};

function getSingleSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseQueueFilters(
  searchParams: Record<string, string | string[] | undefined>,
): FinanceDealQueueFilters {
  const queue = getSingleSearchValue(searchParams.queue);
  const type = getSingleSearchValue(searchParams.type);
  const status = getSingleSearchValue(searchParams.status);
  const applicant = getSingleSearchValue(searchParams.applicant);
  const internalEntity = getSingleSearchValue(searchParams.internalEntity);

  return {
    applicant: applicant?.trim() || undefined,
    internalEntity: internalEntity?.trim() || undefined,
    queue:
      queue === "funding" || queue === "execution" || queue === "failed_instruction"
        ? queue
        : "funding",
    status:
      status &&
      [
        "draft",
        "submitted",
        "rejected",
        "preparing_documents",
        "awaiting_funds",
        "awaiting_payment",
        "closing_documents",
        "done",
        "cancelled",
      ].includes(status)
        ? (status as FinanceDealQueueFilters["status"])
        : undefined,
    type:
      type &&
      [
        "payment",
        "currency_exchange",
        "currency_transit",
        "exporter_settlement",
      ].includes(type)
        ? (type as FinanceDealQueueFilters["type"])
        : undefined,
  };
}

function buildQueueHref(
  current: FinanceDealQueueFilters,
  queue: FinanceDealQueueFilters["queue"],
) {
  const params = new URLSearchParams();
  if (queue) {
    params.set("queue", queue);
  }
  if (current.applicant) {
    params.set("applicant", current.applicant);
  }
  if (current.internalEntity) {
    params.set("internalEntity", current.internalEntity);
  }
  if (current.status) {
    params.set("status", current.status);
  }
  if (current.type) {
    params.set("type", current.type);
  }
  return `/treasury/deals?${params.toString()}`;
}

export default async function TreasuryDealsPage({ searchParams }: PageProps) {
  const filters = parseQueueFilters(await searchParams);
  const data = await getFinanceDealQueues(filters);
  const activeQueue = filters.queue ?? "funding";

  return (
    <EntityListPageShell
      icon={BriefcaseBusiness}
      title="Сделки"
      description="Очереди фондирования и исполнения для treasury-linked сделок."
      fallback={<DataTableSkeleton columnCount={6} rowCount={8} filterCount={3} />}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          {(
            ["funding", "execution", "failed_instruction"] as const
          ).map((queue) => (
            <Link key={queue} href={buildQueueHref(filters, queue)}>
              <Badge variant={activeQueue === queue ? "default" : "secondary"}>
                {QUEUE_LABELS[queue]} · {data.counts[queue]}
              </Badge>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Фильтры</CardTitle>
            <CardDescription>
              Очередь переключается вкладками выше, остальные фильтры применяются ко
              всем вкладкам.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="queue" value={activeQueue} />
              <Input
                name="applicant"
                defaultValue={filters.applicant ?? ""}
                placeholder="Заявитель"
              />
              <Input
                name="internalEntity"
                defaultValue={filters.internalEntity ?? ""}
                placeholder="Внутренняя организация"
              />
              <select
                name="type"
                defaultValue={filters.type ?? "all"}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">Все типы</option>
                <option value="payment">Платеж</option>
                <option value="currency_exchange">Обмен</option>
                <option value="currency_transit">Транзит</option>
                <option value="exporter_settlement">Экспортер</option>
              </select>
              <div className="flex gap-3">
                <select
                  name="status"
                  defaultValue={filters.status ?? "all"}
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">Все статусы</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border px-3 text-sm font-medium"
                >
                  Применить
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{QUEUE_LABELS[activeQueue]}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.items.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По выбранным фильтрам сделок нет.
              </div>
            ) : (
              <div className="space-y-3">
                {data.items.map((item) => (
                  <div
                    key={item.dealId}
                    className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">
                          {TYPE_LABELS[item.type] ?? item.type}
                        </div>
                        <Badge variant="outline">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.applicantName ?? "Заявитель не указан"} ·{" "}
                        {item.internalEntityName ?? "Организация не указана"}
                      </div>
                      <div className="text-sm">{item.queueReason}</div>
                      <div className="text-xs text-muted-foreground">
                        Следующее действие: {item.nextAction}
                      </div>
                      {item.blockingReasons.length > 0 ? (
                        <div className="space-y-1">
                          {item.blockingReasons.map((reason) => (
                            <div
                              key={reason}
                              className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              {reason}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>
                        Исполнение: {item.executionSummary.doneLegCount}/
                        {item.executionSummary.totalLegCount}
                      </div>
                      <div>Документы: {item.documentSummary.formalDocumentCount}</div>
                      <div>Вложения: {item.documentSummary.attachmentCount}</div>
                      {item.quoteSummary?.expiresAt ? (
                        <div>Котировка до: {item.quoteSummary.expiresAt}</div>
                      ) : null}
                      {item.profitabilitySnapshot ? (
                        <div>
                          Выручка: {item.profitabilitySnapshot.totalRevenueMinor}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-start justify-end">
                      <DealWorkflowDialog dealId={item.dealId} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EntityListPageShell>
  );
}
