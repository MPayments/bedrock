"use client";

import type {
  FinanceDealWorkbench,
  FinanceProfitabilityAmount,
} from "@/features/treasury/deals/lib/queries";
import { formatMinorAmountWithCurrency } from "@/lib/format";

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

function countPendingDocuments(
  docs: FinanceDealWorkbench["relatedResources"]["formalDocuments"],
) {
  return docs.filter(
    (doc) =>
      doc.submissionStatus === "pending" || doc.submissionStatus === "draft",
  ).length;
}

export interface ExecutionSummaryBarProps {
  deal: FinanceDealWorkbench;
}

export function ExecutionSummaryBar({ deal }: ExecutionSummaryBarProps) {
  const total = deal.instructionSummary.totalOperations;
  const done = deal.instructionSummary.terminalOperations;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const documents = deal.relatedResources.formalDocuments;
  const pendingDocs = countPendingDocuments(documents);

  return (
    <div className="bg-card grid grid-cols-2 gap-4 rounded-lg border p-4 md:grid-cols-5">
      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Прогресс
        </div>
        <div className="text-base font-semibold">
          {done} / {total}
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Доход по комиссиям
        </div>
        <div className="text-base font-medium text-emerald-600 font-mono">
          {formatAmounts(deal.profitabilitySnapshot?.feeRevenue)}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Доход по спреду
        </div>
        <div className="text-base font-medium text-emerald-600 font-mono">
          {formatAmounts(deal.profitabilitySnapshot?.spreadRevenue)}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Расходы провайдера
        </div>
        <div className="text-base font-medium font-mono">
          {formatAmounts(deal.profitabilitySnapshot?.providerFeeExpense)}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Документы
        </div>
        <div className="text-base font-semibold">
          {documents.length}{" "}
          {pendingDocs > 0 ? (
            <span className="text-muted-foreground text-xs font-normal">
              · {pendingDocs} в работе
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
