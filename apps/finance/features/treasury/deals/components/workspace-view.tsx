import { Badge } from "@bedrock/sdk-ui/components/badge";

import { formatDate } from "@/lib/format";
import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";
import {
  getDealCapabilityLabel,
  getDealCapabilityStatusLabel,
  getDealCapabilityStatusVariant,
  getDealLegKindLabel,
  getDealLegStateLabel,
  getDealOperationalPositionLabel,
  getDealOperationalPositionStateLabel,
  getDealOperationalPositionStateVariant,
  getDealQuoteStatusLabel,
  getDealQuoteStatusVariant,
  getDealTimelineEventLabel,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";

type FinanceDealWorkspaceViewProps = {
  deal: FinanceDealWorkspace;
};

function formatDateTime(value: string | null | undefined) {
  return value ? formatDate(value) : "—";
}

export function FinanceDealWorkspaceView({
  deal,
}: FinanceDealWorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">
              {getFinanceDealTypeLabel(deal.summary.type)}
            </div>
            <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
              {getFinanceDealStatusLabel(deal.summary.status)}
            </Badge>
          </div>
          <div className="mt-2 text-muted-foreground">
            {deal.summary.applicantDisplayName ?? "Заявитель не указан"} ·{" "}
            {deal.summary.internalEntityDisplayName ?? "Организация не указана"}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Создана: {formatDateTime(deal.summary.createdAt)}
          </div>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">Очередь</div>
            <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
              {getFinanceDealQueueLabel(deal.queueContext.queue)}
            </Badge>
          </div>
          <div className="mt-2 text-muted-foreground">
            {deal.queueContext.queueReason}
          </div>
          {deal.queueContext.blockers.length > 0 ? (
            <div className="mt-2 space-y-1 text-red-600">
              {deal.queueContext.blockers.map((blocker) => (
                <div key={blocker}>{blocker}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Принятая котировка</div>
          {deal.acceptedQuote ? (
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div>Котировка: {deal.acceptedQuote.quoteId}</div>
              <div className="flex items-center gap-2">
                <span>Статус:</span>
                <Badge
                  variant={getDealQuoteStatusVariant(
                    deal.acceptedQuote.quoteStatus,
                  )}
                >
                  {getDealQuoteStatusLabel(deal.acceptedQuote.quoteStatus)}
                </Badge>
              </div>
              <div>Истекает: {formatDateTime(deal.acceptedQuote.expiresAt)}</div>
              <div>Исполнена: {formatDateTime(deal.acceptedQuote.usedAt)}</div>
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">
              Котировка не принята.
            </div>
          )}
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Финансовый результат</div>
          {deal.profitabilitySnapshot ? (
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div>Комиссия: {deal.profitabilitySnapshot.feeRevenueMinor}</div>
              <div>Спред: {deal.profitabilitySnapshot.spreadRevenueMinor}</div>
              <div>Итого: {deal.profitabilitySnapshot.totalRevenueMinor}</div>
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
          Возможности
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {deal.operationalState.capabilities.map((capability) => (
            <div key={capability.kind} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">
                  {getDealCapabilityLabel(capability.kind)}
                </div>
                <Badge
                  variant={getDealCapabilityStatusVariant(capability.status)}
                >
                  {getDealCapabilityStatusLabel(capability.status)}
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
          {deal.operationalState.positions.map((position) => (
            <div key={position.kind} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">
                  {getDealOperationalPositionLabel(position.kind)}
                </div>
                <Badge
                  variant={getDealOperationalPositionStateVariant(
                    position.state,
                  )}
                >
                  {getDealOperationalPositionStateLabel(position.state)}
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
            {deal.executionPlan.map((leg) => (
              <div key={`${leg.idx}:${leg.kind}`}>
                {leg.idx}. {getDealLegKindLabel(leg.kind)} ·{" "}
                {getDealLegStateLabel(leg.state)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Связанные ресурсы</div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>Котировки: {deal.relatedResources.quotes.length}</div>
            <div>Документы: {deal.relatedResources.formalDocuments.length}</div>
            <div>Вложения: {deal.relatedResources.attachments.length}</div>
          </div>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Таймлайн</div>
          <div className="mt-2 space-y-2 text-muted-foreground">
            {deal.timeline.slice(0, 6).map((event) => (
              <div key={event.id}>
                <div>{getDealTimelineEventLabel(event.type)}</div>
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
  );
}

