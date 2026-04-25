"use client";

import { ArrowRight } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import { getDealLegKindLabel } from "@/features/treasury/deals/labels";
import type {
  FinanceDealRouteAttachment,
  FinanceDealRouteAttachmentLeg,
  FinanceDealWorkbench,
  FinanceProfitabilityAmount,
} from "@/features/treasury/deals/lib/queries";
import { formatMinorAmountWithCurrency } from "@/lib/format";

import { getLegKindIcon } from "./leg-icon";

function formatShagPlural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "шаг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шага";
  return "шагов";
}

function formatHopPlural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "переход";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "перехода";
  return "переходов";
}

function formatCurrencyLabel(code: string | null, currencyId: string): string {
  if (code) return code;
  return currencyId.length > 8 ? `${currencyId.slice(0, 8)}…` : currencyId;
}

function classifyRouteLeg(leg: FinanceDealRouteAttachmentLeg): {
  label: string;
  variant: "default" | "secondary" | "outline";
} {
  if (leg.fromCurrencyId === leg.toCurrencyId) {
    return { label: "Внутренний перевод", variant: "outline" };
  }
  return { label: "Конвертация", variant: "secondary" };
}

function formatAmounts(items: FinanceProfitabilityAmount[] | null | undefined) {
  if (!items || items.length === 0) {
    return "—";
  }
  return items
    .map((item) =>
      formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode),
    )
    .join(" · ");
}

function RouteAttachmentHops({
  attachment,
}: {
  attachment: FinanceDealRouteAttachment;
}) {
  if (attachment.legs.length === 0) {
    return <div className="text-muted-foreground text-sm">Нет переходов.</div>;
  }

  return (
    <ol className="flex flex-col gap-1.5" data-testid="finance-deal-route-hops">
      {attachment.legs.map((leg, index) => {
        const classification = classifyRouteLeg(leg);
        const fromLabel = formatCurrencyLabel(
          leg.fromCurrencyCode,
          leg.fromCurrencyId,
        );
        const toLabel = formatCurrencyLabel(
          leg.toCurrencyCode,
          leg.toCurrencyId,
        );
        const hopIndex = index + 1;
        const feeText = leg.fees
          .filter((fee) => fee.percentage !== null)
          .map((fee) => `${fee.label} ${fee.percentage}%`)
          .join(" · ");

        return (
          <li
            key={leg.id}
            className="flex items-center gap-2 text-sm"
            data-testid={`finance-deal-route-hop-${hopIndex}`}
          >
            <div className="bg-muted text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]">
              {hopIndex}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="font-mono text-xs">{fromLabel}</span>
              <ArrowRight className="text-muted-foreground h-3 w-3" />
              <span className="font-mono text-xs">{toLabel}</span>
              <Badge
                variant={classification.variant}
                className="ml-1 text-[10px] font-normal"
              >
                {classification.label}
              </Badge>
              {feeText ? (
                <span className="text-muted-foreground truncate text-xs">
                  {feeText}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface ExecutionContextGridProps {
  canWrite: boolean;
  deal: FinanceDealWorkbench;
  onOpenSwapRoute: () => void;
}

export function ExecutionContextGrid({
  canWrite,
  deal,
  onOpenSwapRoute,
}: ExecutionContextGridProps) {
  const legs = deal.executionPlan;
  const routeAttachment = deal.pricing.routeAttachment;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="bg-card rounded-lg border">
        <header className="flex items-center justify-between gap-2 border-b p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Маршрут</div>
            <div className="text-muted-foreground truncate text-xs">
              {routeAttachment
                ? `${routeAttachment.templateName} · ${routeAttachment.legs.length} ${formatHopPlural(
                    routeAttachment.legs.length,
                  )}`
                : "Шаблон не привязан"}
            </div>
          </div>
          {canWrite ? (
            <Button
              data-testid="finance-deal-swap-route"
              size="sm"
              variant="outline"
              onClick={onOpenSwapRoute}
            >
              {routeAttachment ? "Сменить шаблон" : "Выбрать маршрут"}
            </Button>
          ) : null}
        </header>
        <div className="flex flex-col gap-2 p-3">
          {routeAttachment ? (
            <RouteAttachmentHops attachment={routeAttachment} />
          ) : (
            <div className="text-muted-foreground text-sm">
              Маршрут пока не выбран. Нажмите «Выбрать маршрут», чтобы
              привязать подходящий шаблон.
            </div>
          )}

          <div className="border-t pt-2">
            <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">
              Шаги исполнения
              <span className="ml-1 normal-case tracking-normal">
                ({legs.length} {formatShagPlural(legs.length)})
              </span>
            </div>
            {legs.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                План появится после материализации операций.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {legs.map((leg) => {
                  const KindIcon = getLegKindIcon(leg.kind);
                  return (
                    <li
                      key={leg.id ?? `${leg.idx}:${leg.kind}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div
                        className="bg-muted text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        title={`Шаг ${leg.idx}`}
                      >
                        <KindIcon className="h-3 w-3" />
                      </div>
                      <span className="flex-1 truncate">
                        {getDealLegKindLabel(leg.kind)}
                      </span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {leg.operationRefs.length}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card rounded-lg border">
        <header className="border-b p-3">
          <div className="text-sm font-semibold">Денежный поток</div>
        </header>
        <div className="flex flex-col gap-2 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Доход по комиссиям</span>
            <span className="font-mono font-medium text-emerald-600">
              {formatAmounts(deal.profitabilitySnapshot?.feeRevenue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Доход по спреду</span>
            <span className="font-mono font-medium text-emerald-600">
              {formatAmounts(deal.profitabilitySnapshot?.spreadRevenue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Расходы провайдера</span>
            <span className="font-mono font-medium">
              {formatAmounts(deal.profitabilitySnapshot?.providerFeeExpense)}
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Итого выручка</span>
              <span className="font-mono font-medium">
                {formatAmounts(deal.profitabilitySnapshot?.totalRevenue)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
