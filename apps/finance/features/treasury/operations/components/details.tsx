import Link from "next/link";
import { ArrowRightLeft, Workflow } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { formatDate } from "@/lib/format";
import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";

import type { TreasuryOperationDetails } from "../lib/queries";
import {
  getTreasuryOperationDisplayTitle,
  getTreasuryOperationInstructionStatusLabel,
  getTreasuryOperationInstructionStatusVariant,
  getTreasuryOperationKindLabel,
  getTreasuryOperationKindVariant,
  getTreasuryOperationStateLabel,
} from "../lib/labels";

type TreasuryOperationDetailsProps = {
  operation: TreasuryOperationDetails;
};

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function AccountCard({
  title,
  label,
  identity,
}: {
  title: string;
  label: string;
  identity: string | null;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        <DetailValue label="Профиль" value={label} />
        {identity && identity !== label ? (
          <DetailValue label="Идентификатор" value={identity} />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TreasuryOperationDetailsView({
  operation,
}: TreasuryOperationDetailsProps) {
  const title = getTreasuryOperationDisplayTitle({
    applicantName: operation.dealRef?.applicantName,
    dealId: operation.dealRef?.dealId,
    id: operation.id,
    kind: operation.kind,
  });
  const blockers =
    operation.queueContext?.blockers.map((message) =>
      formatDealWorkflowMessage(message),
    ) ?? [];

  return (
    <EntityWorkspaceLayout
      icon={Workflow}
      title={title}
      subtitle="Панель materialized treasury-операции и связанного контекста сделки."
      controls={
        operation.dealWorkbenchHref ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={operation.dealWorkbenchHref} />}
          >
            Перейти к сделке
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="grid gap-4">
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Сводка операции
              </CardTitle>
              <CardDescription>
                Основные реквизиты операции и текущий read-only статус.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
              <DetailValue
                label="Операция"
                value={
                  <Badge variant={getTreasuryOperationKindVariant(operation.kind)}>
                    {getTreasuryOperationKindLabel(operation.kind)}
                  </Badge>
                }
              />
              <DetailValue
                label="Статус инструкции"
                value={
                  <Badge
                    variant={getTreasuryOperationInstructionStatusVariant(
                      operation.instructionStatus,
                    )}
                  >
                    {getTreasuryOperationInstructionStatusLabel(
                      operation.instructionStatus,
                    )}
                  </Badge>
                }
              />
              <DetailValue label="Состояние" value={getTreasuryOperationStateLabel(operation.state)} />
              <DetailValue label="Создана" value={formatDate(operation.createdAt)} />
              <DetailValue label="Сумма" value={operation.amount.formatted} />
              <DetailValue
                label="Контрсумма"
                value={operation.counterAmount?.formatted ?? "—"}
              />
              <DetailValue
                label="Внутренняя организация"
                value={operation.internalEntity.name ?? "—"}
              />
              <DetailValue
                label="Следующий шаг"
                value={formatDealNextAction(operation.nextAction)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <AccountCard
              title="Источник"
              label={operation.sourceAccount.label}
              identity={operation.sourceAccount.identity}
            />
            <AccountCard
              title="Назначение"
              label={operation.destinationAccount.label}
              identity={operation.destinationAccount.identity}
            />
          </div>

          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Маршрут и блокеры</CardTitle>
              <CardDescription>
                Провайдер исполнения и состояние связанной сделки.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <DetailValue label="Провайдер / маршрут" value={operation.providerRoute} />
              {operation.queueContext ? (
                <>
                  <DetailValue
                    label="Очередь сделки"
                    value={
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={getFinanceDealQueueVariant(
                            operation.queueContext.queue,
                          )}
                        >
                          {getFinanceDealQueueLabel(operation.queueContext.queue)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDealWorkflowMessage(
                            operation.queueContext.queueReason,
                          )}
                        </span>
                      </div>
                    }
                  />
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Блокеры
                    </div>
                    {blockers.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Без блокеров
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Связанный queue-контекст не найден.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Сделка</CardTitle>
              <CardDescription>
                Исходная сделка и leg reference для операции.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {operation.dealRef ? (
                <>
                  <DetailValue
                    label="Тип"
                    value={getFinanceDealTypeLabel(operation.dealRef.type)}
                  />
                  <DetailValue
                    label="Заявитель"
                    value={operation.dealRef.applicantName ?? "—"}
                  />
                  <DetailValue
                    label="Статус сделки"
                    value={
                      <Badge
                        variant={getFinanceDealStatusVariant(
                          operation.dealRef.status,
                        )}
                      >
                        {getFinanceDealStatusLabel(operation.dealRef.status)}
                      </Badge>
                    }
                  />
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Сделка не связана с этой операцией.
                </div>
              )}
              <DetailValue label="Source ref" value={operation.sourceRef} />
              <DetailValue
                label="Leg"
                value={
                  operation.legRef
                    ? `${operation.legRef.idx}. ${operation.legRef.kind}`
                    : "—"
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </EntityWorkspaceLayout>
  );
}
