"use client";

import { useState } from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/sdk-ui/components/dialog";

const CAPABILITY_LABELS: Record<string, string> = {
  can_collect: "Сбор средств",
  can_exporter_settle: "Расчеты экспортера",
  can_fx: "FX",
  can_payout: "Выплата",
  can_transit: "Транзит",
};

const CAPABILITY_STATUS_LABELS: Record<string, string> = {
  disabled: "Выключена",
  enabled: "Включена",
  pending: "Ожидает настройки",
};

const POSITION_LABELS: Record<string, string> = {
  customer_receivable: "Дебиторка клиента",
  exporter_expected_receivable: "Ожидаемая выручка экспортера",
  fee_revenue: "Комиссионный доход",
  in_transit: "Средства в транзите",
  intercompany_due_from: "Межкомпанейская дебиторка",
  intercompany_due_to: "Межкомпанейская кредиторка",
  provider_payable: "Обязательство перед провайдером",
  spread_revenue: "Доход от спреда",
  suspense: "Суспенс",
};

const POSITION_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирована",
  done: "Закрыта",
  in_progress: "В работе",
  not_applicable: "Не применяется",
  pending: "Ожидает",
  ready: "Готова",
};

const TYPE_LABELS: Record<string, string> = {
  currency_exchange: "Обмен",
  currency_transit: "Транзит",
  exporter_settlement: "Экспортер",
  payment: "Платеж",
};

const TIMELINE_LABELS: Record<string, string> = {
  attachment_deleted: "Вложение удалено",
  attachment_uploaded: "Вложение загружено",
  calculation_attached: "Расчет привязан",
  deal_created: "Сделка создана",
  document_created: "Документ создан",
  document_status_changed: "Статус документа изменен",
  intake_saved: "Анкета сохранена",
  leg_state_changed: "Состояние этапа обновлено",
  participant_changed: "Участники обновлены",
  quote_accepted: "Котировка принята",
  quote_created: "Котировка создана",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка использована",
  status_changed: "Статус сделки изменен",
};

type FinanceWorkspaceResponse = {
  acceptedQuote: {
    acceptedAt: string;
    expiresAt: string | null;
    quoteId: string;
    quoteStatus: string;
    usedAt: string | null;
  } | null;
  executionPlan: Array<{
    idx: number;
    kind: string;
    state: string;
  }>;
  operationalState: {
    capabilities: Array<{
      kind: string;
      note: string | null;
      reasonCode: string | null;
      status: string;
    }>;
    positions: Array<{
      amountMinor: string | null;
      kind: string;
      reasonCode: string | null;
      state: string;
    }>;
  };
  profitabilitySnapshot: {
    calculationId: string;
    feeRevenueMinor: string;
    spreadRevenueMinor: string;
    totalRevenueMinor: string;
  } | null;
  queueContext: {
    blockers: string[];
    queue: string;
    queueReason: string;
  };
  relatedResources: {
    attachments: Array<{ id: string }>;
    formalDocuments: Array<{ docType: string; id: string }>;
    quotes: Array<{ id: string; status: string }>;
  };
  summary: {
    applicantDisplayName: string | null;
    id: string;
    internalEntityDisplayName: string | null;
    status: string;
    type: string;
  };
  timeline: Array<{
    actor: {
      label: string | null;
    } | null;
    id: string;
    occurredAt: string;
    type: string;
  }>;
};

type DealWorkflowDialogProps = {
  dealId: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("ru-RU");
}

export function DealWorkflowDialog({ dealId }: DealWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FinanceWorkspaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadWorkflow() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/v1/deals/${encodeURIComponent(dealId)}/finance-workspace`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Не удалось загрузить deal workspace (${response.status})`);
      }

      setData((await response.json()) as FinanceWorkspaceResponse);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить deal workspace",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void loadWorkflow();
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Workspace
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Finance workspace сделки</DialogTitle>
        </DialogHeader>

        {isLoading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">
                  {TYPE_LABELS[data.summary.type] ?? data.summary.type}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {data.summary.applicantDisplayName ?? "Заявитель не указан"} ·{" "}
                  {data.summary.internalEntityDisplayName ??
                    "Организация не указана"}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Очередь</div>
                <div className="mt-1 text-muted-foreground">
                  {data.queueContext.queueReason}
                </div>
                {data.queueContext.blockers.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {data.queueContext.blockers.map((blocker) => (
                      <div key={blocker} className="text-red-600">
                        {blocker}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Принятая котировка</div>
                {data.acceptedQuote ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <div>Quote: {data.acceptedQuote.quoteId}</div>
                    <div>Статус: {data.acceptedQuote.quoteStatus}</div>
                    <div>Истекает: {formatDateTime(data.acceptedQuote.expiresAt)}</div>
                    <div>Использована: {formatDateTime(data.acceptedQuote.usedAt)}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-muted-foreground">Котировка не принята.</div>
                )}
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Профитабилити</div>
                {data.profitabilitySnapshot ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <div>Fee: {data.profitabilitySnapshot.feeRevenueMinor}</div>
                    <div>Spread: {data.profitabilitySnapshot.spreadRevenueMinor}</div>
                    <div>Total: {data.profitabilitySnapshot.totalRevenueMinor}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-muted-foreground">
                    Текущий расчет еще не сформирован.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Capability gate
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {data.operationalState.capabilities.map((capability) => (
                  <div key={capability.kind} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {CAPABILITY_LABELS[capability.kind] ?? capability.kind}
                      </div>
                      <Badge variant={capability.status === "enabled" ? "default" : "secondary"}>
                        {CAPABILITY_STATUS_LABELS[capability.status] ?? capability.status}
                      </Badge>
                    </div>
                    {(capability.reasonCode || capability.note) && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {[capability.reasonCode, capability.note]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Позиции</div>
              <div className="grid gap-3 md:grid-cols-2">
                {data.operationalState.positions.map((position) => (
                  <div key={position.kind} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {POSITION_LABELS[position.kind] ?? position.kind}
                      </div>
                      <Badge variant={position.state === "done" ? "default" : "secondary"}>
                        {POSITION_STATE_LABELS[position.state] ?? position.state}
                      </Badge>
                    </div>
                    {(position.reasonCode || position.amountMinor) && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {[position.reasonCode, position.amountMinor]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Этапы исполнения</div>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {data.executionPlan.map((leg) => (
                    <div key={`${leg.idx}:${leg.kind}`}>
                      {leg.idx}. {leg.kind} · {leg.state}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Связанные ресурсы</div>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <div>Quotes: {data.relatedResources.quotes.length}</div>
                  <div>Документы: {data.relatedResources.formalDocuments.length}</div>
                  <div>Вложения: {data.relatedResources.attachments.length}</div>
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Таймлайн</div>
                <div className="mt-2 space-y-2 text-muted-foreground">
                  {data.timeline.slice(0, 6).map((event) => (
                    <div key={event.id}>
                      <div>{TIMELINE_LABELS[event.type] ?? event.type}</div>
                      <div className="text-xs">
                        {formatDateTime(event.occurredAt)}
                        {event.actor?.label ? ` · ${event.actor.label}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
