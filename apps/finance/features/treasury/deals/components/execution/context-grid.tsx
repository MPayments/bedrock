"use client";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import { getDealLegKindLabel } from "@/features/treasury/deals/labels";
import type {
  FinanceDealWorkbench,
  FinanceProfitabilityAmount,
} from "@/features/treasury/deals/lib/queries";
import { formatMinorAmountWithCurrency } from "@/lib/format";

import { getLegKindIcon } from "./leg-icon";

type Participant = NonNullable<
  FinanceDealWorkbench["workflow"]
>["participants"][number];

function formatShagPlural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "шаг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шага";
  return "шагов";
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

function getParticipantRoleLabel(role: Participant["role"]): string {
  switch (role) {
    case "customer":
      return "Клиент";
    case "applicant":
      return "Заявитель";
    case "internal_entity":
      return "Внутренний контрагент";
    case "external_payer":
      return "Внешний плательщик";
    case "external_beneficiary":
      return "Бенефициар";
    default:
      return role;
  }
}

function getParticipantIdentity(participant: Participant): string | null {
  return (
    participant.counterpartyId ??
    participant.customerId ??
    participant.organizationId ??
    null
  );
}

function formatParticipantIdentity(id: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function resolveParticipantName(
  participant: Participant,
  summary: FinanceDealWorkbench["summary"],
): string {
  if (
    participant.role === "applicant" ||
    participant.role === "customer"
  ) {
    return (
      summary.applicantDisplayName ??
      formatParticipantIdentity(getParticipantIdentity(participant))
    );
  }
  if (participant.role === "internal_entity") {
    return (
      summary.internalEntityDisplayName ??
      formatParticipantIdentity(getParticipantIdentity(participant))
    );
  }
  return formatParticipantIdentity(getParticipantIdentity(participant));
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
  const participants = deal.workflow?.participants ?? [];
  const legs = deal.executionPlan;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <section className="bg-card rounded-lg border">
        <header className="flex items-center justify-between gap-2 border-b p-3">
          <div>
            <div className="text-sm font-semibold">Маршрут</div>
            <div className="text-muted-foreground text-xs">
              {legs.length === 0
                ? "Шаблон не привязан"
                : `${legs.length} ${formatShagPlural(legs.length)}`}
            </div>
          </div>
          {canWrite ? (
            <Button
              data-testid="finance-deal-swap-route"
              size="sm"
              variant="outline"
              onClick={onOpenSwapRoute}
            >
              Сменить шаблон
            </Button>
          ) : null}
        </header>
        <div className="flex flex-col gap-1.5 p-3">
          {legs.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Маршрут появится после выбора шаблона в коммерческой вкладке.
            </div>
          ) : (
            legs.map((leg) => {
              const KindIcon = getLegKindIcon(leg.kind);
              return (
                <div
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
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="bg-card rounded-lg border">
        <header className="border-b p-3">
          <div className="text-sm font-semibold">Стороны</div>
        </header>
        <div className="flex flex-col gap-3 p-3">
          {participants.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Участники ещё не назначены.
            </div>
          ) : (
            participants.map((participant, index) => {
              const identity = getParticipantIdentity(participant);
              const name = resolveParticipantName(participant, deal.summary);
              const showIdentityHint =
                identity !== null && name !== identity && !name.includes("…");
              return (
                <div
                  key={`${participant.role}:${identity ?? index}`}
                  className="space-y-0.5"
                >
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">
                    {getParticipantRoleLabel(participant.role)}
                  </div>
                  <div className="text-sm font-medium">{name}</div>
                  {showIdentityHint ? (
                    <div className="text-muted-foreground font-mono text-xs">
                      {formatParticipantIdentity(identity)}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
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
