import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { DealContextContent } from "./deal-context-content";

export type OverviewTabProps = {
  deal: FinanceDealWorkbench;
};

export function OverviewTab({ deal }: OverviewTabProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Обзор сделки</CardTitle>
            <div className="text-sm text-muted-foreground">
              {getFinanceDealTypeLabel(deal.summary.type)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
              {getFinanceDealStatusLabel(deal.summary.status)}
            </Badge>
            <Badge
              variant={getFinanceDealQueueVariant(deal.queueContext.queue)}
            >
              {getFinanceDealQueueLabel(deal.queueContext.queue)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-medium">Контекст сделки</div>
          <DealContextContent deal={deal} />
        </div>
      </CardContent>
    </Card>
  );
}
