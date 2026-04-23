import { FORMAL_DOCUMENT_LABELS } from "@/features/treasury/deals/labels";
import { getFinanceDealExecutionProgress } from "@/features/treasury/deals/lib/execution-summary";
import type {
  FinanceDealCashflowSummary,
  FinanceDealWorkbench,
  FinanceProfitabilityAmount,
} from "@/features/treasury/deals/lib/queries";
import { formatMinorAmountWithCurrency } from "@/lib/format";

import { MetricTile, type MetricTileTone } from "./metric-tile";

export type DealExecutionHeaderSummaryProps = {
  deal: FinanceDealWorkbench;
};

type AmountTileKind = "received" | "scheduled-out";

function firstAmount(
  entries: FinanceProfitabilityAmount[],
): FinanceProfitabilityAmount | null {
  return entries[0] ?? null;
}

function formatSignedAmount(
  entry: FinanceProfitabilityAmount,
  kind: AmountTileKind,
): string {
  const formatted = formatMinorAmountWithCurrency(
    entry.amountMinor,
    entry.currencyCode,
  );
  if (kind === "scheduled-out") {
    return `−${formatted}`;
  }
  return `+${formatted}`;
}

function renderAmountTile(options: {
  label: string;
  testId: string;
  amounts: FinanceProfitabilityAmount[];
  kind: AmountTileKind;
  sublabelPresent: string;
  sublabelEmpty: string;
  tonePresent: MetricTileTone;
}) {
  const amount = firstAmount(options.amounts);
  if (!amount) {
    return (
      <MetricTile
        testId={options.testId}
        label={options.label}
        value={<span className="text-muted-foreground">—</span>}
        sublabel={options.sublabelEmpty}
      />
    );
  }
  return (
    <MetricTile
      testId={options.testId}
      label={options.label}
      tone={options.tonePresent}
      value={formatSignedAmount(amount, options.kind)}
      sublabel={options.sublabelPresent}
    />
  );
}

function renderProgressTile(
  executionProgress: ReturnType<typeof getFinanceDealExecutionProgress>,
) {
  const { doneLegCount, totalLegCount } = executionProgress;
  const pct =
    totalLegCount > 0
      ? Math.min(100, Math.round((doneLegCount / totalLegCount) * 100))
      : 0;

  return (
    <MetricTile
      testId="finance-deal-header-progress"
      label="Прогресс"
      value={`${doneLegCount} / ${totalLegCount}`}
      footer={
        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      }
    />
  );
}

function renderMarginTile(deal: FinanceDealWorkbench) {
  const snapshot = deal.profitabilitySnapshot;
  const primary = snapshot?.totalRevenue[0] ?? null;

  if (!snapshot) {
    return (
      <MetricTile
        testId="finance-deal-header-margin"
        label="Маржа"
        value={<span className="text-muted-foreground">—</span>}
        sublabel="нет расчёта"
      />
    );
  }

  if (!primary) {
    return (
      <MetricTile
        testId="finance-deal-header-margin"
        label="Маржа"
        value={<span className="text-muted-foreground">—</span>}
        sublabel="ожидается"
      />
    );
  }

  const value = formatMinorAmountWithCurrency(
    primary.amountMinor,
    primary.currencyCode,
  );
  const isPositive = (() => {
    try {
      return BigInt(primary.amountMinor) > 0n;
    } catch {
      return false;
    }
  })();

  return (
    <MetricTile
      testId="finance-deal-header-margin"
      label="Маржа"
      tone={isPositive ? "positive" : "default"}
      value={isPositive ? `+${value}` : value}
      sublabel="захвачено"
    />
  );
}

type FormalDocRequirement =
  FinanceDealWorkbench["formalDocumentRequirements"][number];

const STAGE_ORDER: Record<FormalDocRequirement["stage"], number> = {
  opening: 0,
  closing: 1,
};

function getDocTypeLabel(docType: string): string {
  return FORMAL_DOCUMENT_LABELS[docType] ?? docType;
}

function findNextMissingRequirement(
  requirements: readonly FormalDocRequirement[],
): FormalDocRequirement | null {
  const pending = requirements.filter(
    (r) => r.state === "missing" || r.state === "in_progress",
  );
  if (pending.length === 0) return null;
  return [...pending].sort(
    (left, right) => STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage],
  )[0]!;
}

function renderDocumentsTile(deal: FinanceDealWorkbench) {
  const requirements = deal.formalDocumentRequirements;
  const required = requirements.filter((r) => r.state !== "not_required");
  const ready = required.filter((r) => r.state === "ready");
  const requiredCount = required.length;
  const readyCount = ready.length;

  if (requiredCount === 0) {
    return (
      <MetricTile
        testId="finance-deal-header-documents"
        label="Документы"
        value={<span className="text-muted-foreground">—</span>}
        sublabel="ожидается расчёт"
      />
    );
  }

  if (readyCount === requiredCount) {
    return (
      <MetricTile
        testId="finance-deal-header-documents"
        label="Документы"
        tone="positive"
        value="Готово"
        sublabel="всё оформлено"
      />
    );
  }

  const nextMissing = findNextMissingRequirement(requirements);
  const sublabel = nextMissing
    ? `Не хватает: ${getDocTypeLabel(nextMissing.docType)}`
    : "Документы в работе";

  return (
    <MetricTile
      testId="finance-deal-header-documents"
      label="Документы"
      value={`${readyCount} / ${requiredCount}`}
      sublabel={sublabel}
    />
  );
}

export function DealExecutionHeaderSummary({
  deal,
}: DealExecutionHeaderSummaryProps) {
  const executionProgress = getFinanceDealExecutionProgress(deal);
  const cashflow: FinanceDealCashflowSummary = deal.cashflowSummary;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {renderProgressTile(executionProgress)}
      {renderAmountTile({
        label: "Получено",
        testId: "finance-deal-header-received-in",
        amounts: cashflow.receivedIn,
        kind: "received",
        sublabelPresent: "факт",
        sublabelEmpty: "ожидается",
        tonePresent: "positive",
      })}
      {renderAmountTile({
        label: "К выплате",
        testId: "finance-deal-header-scheduled-out",
        amounts: cashflow.scheduledOut,
        kind: "scheduled-out",
        sublabelPresent: "план",
        sublabelEmpty: "ожидается",
        tonePresent: "default",
      })}
      {renderMarginTile(deal)}
      {renderDocumentsTile(deal)}
    </div>
  );
}
