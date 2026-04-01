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

type DealWorkflowResponse = {
  nextAction: string;
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
  summary: {
    id: string;
    status: string;
    type: string;
  };
};

type DealWorkflowDialogProps = {
  dealId: string;
};

export function DealWorkflowDialog({ dealId }: DealWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DealWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadWorkflow() {
    if (data || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/v1/deals/${encodeURIComponent(dealId)}/workflow`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Не удалось загрузить deal workflow (${response.status})`);
      }

      setData((await response.json()) as DealWorkflowResponse);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить deal workflow",
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
        Состояние
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Операционное состояние сделки</DialogTitle>
        </DialogHeader>

        {isLoading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {data && (
          <div className="space-y-6">
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">Следующее действие</div>
              <div className="mt-1 text-muted-foreground">{data.nextAction}</div>
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
              <div className="text-sm font-medium text-muted-foreground">
                Позиции
              </div>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
