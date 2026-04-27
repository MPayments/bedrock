import { Badge } from "@bedrock/sdk-ui/components/badge";

import {
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { formatDate } from "@/lib/format";

export type DealContextContentProps = {
  deal: FinanceDealWorkbench;
};

export function DealContextContent({ deal }: DealContextContentProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Тип сделки</div>
        <div className="font-medium">
          {getFinanceDealTypeLabel(deal.summary.type)}
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Создана</div>
        <div className="font-medium">{formatDate(deal.summary.createdAt)}</div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Статус</div>
        <div>
          <Badge
            data-testid="finance-deal-status-badge"
            variant={getFinanceDealStatusVariant(deal.summary.status)}
          >
            {getFinanceDealStatusLabel(deal.summary.status)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Очередь</div>
        <div>
          <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
            {getFinanceDealQueueLabel(deal.queueContext.queue)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 text-sm sm:col-span-2">
        <div className="text-muted-foreground">Заявитель</div>
        <div className="font-medium">
          {deal.summary.applicantDisplayName ?? "Не указан"}
        </div>
      </div>
      <div className="space-y-1 text-sm sm:col-span-2">
        <div className="text-muted-foreground">Организация</div>
        <div className="font-medium">
          {deal.summary.internalEntityDisplayName ?? "Не указана"}
        </div>
      </div>
    </div>
  );
}
