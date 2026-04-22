import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
} from "@bedrock/sdk-ui/components/card";

import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
} from "@/features/treasury/deals/labels";
import {
  collectFinanceDealTopBlockers,
  getFinanceDealExecutionProgress,
} from "@/features/treasury/deals/lib/execution-summary";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

export type DealExecutionHeaderSummaryProps = {
  deal: FinanceDealWorkbench;
};

export function DealExecutionHeaderSummary({
  deal,
}: DealExecutionHeaderSummaryProps) {
  const blockers = collectFinanceDealTopBlockers(deal);
  const executionProgress = getFinanceDealExecutionProgress(deal);

  return (
    <Card className="border-muted-foreground/10 bg-gradient-to-br from-background via-background to-muted/30">
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
            {getFinanceDealStatusLabel(deal.summary.status)}
          </Badge>
          <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
            {getFinanceDealQueueLabel(deal.queueContext.queue)}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(3,minmax(0,180px))]">
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Причина очереди
            </div>
            <div className="mt-1 text-sm font-medium">
              {formatDealWorkflowMessage(deal.queueContext.queueReason)}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Следующий шаг
            </div>
            <div className="mt-1 text-sm font-medium">
              {formatDealNextAction(deal.nextAction)}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Завершено
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.doneLegCount}/{executionProgress.totalLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Заблокировано
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.blockedLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Операционных вопросов
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.issueCount}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Что мешает движению сделки</div>
          {blockers.length > 0 ? (
            <div className="space-y-2">
              {blockers.map((blocker) => (
                <Alert key={blocker} variant="warning" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{blocker}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Критичных блокировок сейчас нет.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
