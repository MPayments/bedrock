"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import { formatDate } from "@/lib/format";
import { executeMutation } from "@/lib/resources/http";

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

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOutcomeActionLabel(outcome: "failed" | "returned" | "settled") {
  switch (outcome) {
    case "settled":
      return "Отметить исполненной";
    case "failed":
      return "Отметить с ошибкой";
    case "returned":
      return "Подтвердить возврат";
  }
}

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

function InstructionActions({
  operation,
}: {
  operation: TreasuryOperationDetails;
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const instructionId = operation.latestInstruction?.id ?? null;

  async function runAction(input: {
    actionKey: string;
    body: Record<string, unknown>;
    successMessage: string;
    url: string;
  }) {
    setActiveAction(input.actionKey);

    const result = await executeMutation({
      fallbackMessage: "Не удалось выполнить команду исполнения",
      request: () =>
        fetch(input.url, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify(input.body),
        }),
    });

    setActiveAction(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(input.successMessage);
    router.refresh();
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Команды исполнения</CardTitle>
        <CardDescription>
          Подготовка и движение treasury-инструкции по этой операции.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {operation.actions.canPrepareInstruction ? (
            <Button
              data-testid="finance-operation-prepare"
              size="sm"
              disabled={activeAction === "prepare"}
              onClick={() =>
                runAction({
                  actionKey: "prepare",
                  body: {},
                  successMessage: "Инструкция подготовлена",
                  url: `/v1/treasury/operations/${encodeURIComponent(operation.id)}/instructions/prepare`,
                })
              }
            >
              {activeAction === "prepare" ? "Подготавливаем..." : "Подготовить"}
            </Button>
          ) : null}

          {operation.actions.canSubmitInstruction && instructionId ? (
            <Button
              data-testid="finance-operation-submit"
              size="sm"
              disabled={activeAction === "submit"}
              onClick={() =>
                runAction({
                  actionKey: "submit",
                  body: {},
                  successMessage: "Инструкция отправлена",
                  url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/submit`,
                })
              }
            >
              {activeAction === "submit" ? "Отправляем..." : "Отправить"}
            </Button>
          ) : null}

          {operation.actions.canRetryInstruction && instructionId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={activeAction === "retry"}
              onClick={() =>
                runAction({
                  actionKey: "retry",
                  body: {},
                  successMessage: "Повторная инструкция создана",
                  url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/retry`,
                })
              }
            >
              {activeAction === "retry" ? "Создаем..." : "Повторить"}
            </Button>
          ) : null}

          {operation.actions.canVoidInstruction && instructionId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={activeAction === "void"}
              onClick={() =>
                runAction({
                  actionKey: "void",
                  body: {},
                  successMessage: "Инструкция отменена",
                  url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/void`,
                })
              }
            >
              {activeAction === "void" ? "Отменяем..." : "Отменить"}
            </Button>
          ) : null}

          {operation.actions.canRequestReturn && instructionId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={activeAction === "return"}
              onClick={() =>
                runAction({
                  actionKey: "return",
                  body: {},
                  successMessage: "Возврат запрошен",
                  url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/return`,
                })
              }
            >
              {activeAction === "return"
                ? "Запрашиваем..."
                : "Запросить возврат"}
            </Button>
          ) : null}
        </div>

        {operation.availableOutcomeTransitions.length > 0 && instructionId ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Зафиксировать результат
            </div>
            <div className="flex flex-wrap gap-2">
              {operation.availableOutcomeTransitions.map((outcome) => (
                <Button
                  key={outcome}
                  data-testid={`finance-operation-outcome-${outcome}`}
                  size="sm"
                  variant="outline"
                  disabled={activeAction === `outcome:${outcome}`}
                  onClick={() =>
                    runAction({
                      actionKey: `outcome:${outcome}`,
                      body: { outcome },
                      successMessage: "Результат инструкции сохранен",
                      url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/outcome`,
                    })
                  }
                >
                  {activeAction === `outcome:${outcome}`
                    ? "Сохраняем..."
                    : getOutcomeActionLabel(outcome)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {!operation.actions.canPrepareInstruction &&
        !operation.actions.canSubmitInstruction &&
        !operation.actions.canRetryInstruction &&
        !operation.actions.canVoidInstruction &&
        !operation.actions.canRequestReturn &&
        operation.availableOutcomeTransitions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Для текущего состояния инструкции доступных команд нет.
          </div>
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
      subtitle="Панель treasury-операции, инструкции и связанного контекста сделки."
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
          <InstructionActions operation={operation} />

          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Сводка операции
              </CardTitle>
              <CardDescription>
                Основные реквизиты операции и текущий статус инструкции.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
              <DetailValue
                label="Операция"
                value={
                  <Badge
                    variant={getTreasuryOperationKindVariant(operation.kind)}
                  >
                    {getTreasuryOperationKindLabel(operation.kind)}
                  </Badge>
                }
              />
              <DetailValue
                label="Статус инструкции"
                value={
                  <Badge
                    data-testid="finance-operation-instruction-status"
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
              <DetailValue
                label="Состояние"
                value={getTreasuryOperationStateLabel(operation.state)}
              />
              <DetailValue
                label="Создана"
                value={formatDate(operation.createdAt)}
              />
              <DetailValue label="Сумма" value={operation.amount.formatted} />
              <DetailValue
                label="Контрсумма"
                value={operation.counterAmount?.formatted ?? "—"}
              />
              <DetailValue
                label="Организация"
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
              <DetailValue
                label="Провайдер / маршрут"
                value={operation.providerRoute}
              />
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
                          {getFinanceDealQueueLabel(
                            operation.queueContext.queue,
                          )}
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
              <CardTitle>Инструкция</CardTitle>
              <CardDescription>
                Последняя попытка исполнения materialized операции.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {operation.latestInstruction ? (
                <>
                  <DetailValue
                    label="Instruction ID"
                    value={operation.latestInstruction.id}
                  />
                  <DetailValue
                    label="Attempt"
                    value={String(operation.latestInstruction.attempt)}
                  />
                  <DetailValue
                    label="State"
                    value={getTreasuryOperationInstructionStatusLabel(
                      operation.latestInstruction.state,
                    )}
                  />
                  <DetailValue
                    label="Provider ref"
                    value={operation.latestInstruction.providerRef ?? "—"}
                  />
                  <DetailValue
                    label="Подготовлена"
                    value={formatDate(operation.latestInstruction.createdAt)}
                  />
                  <DetailValue
                    label="Отправлена"
                    value={
                      operation.latestInstruction.submittedAt
                        ? formatDate(operation.latestInstruction.submittedAt)
                        : "—"
                    }
                  />
                  <DetailValue
                    label="Исполнена"
                    value={
                      operation.latestInstruction.settledAt
                        ? formatDate(operation.latestInstruction.settledAt)
                        : "—"
                    }
                  />
                  <DetailValue
                    label="Ошибка"
                    value={
                      operation.latestInstruction.failedAt
                        ? formatDate(operation.latestInstruction.failedAt)
                        : "—"
                    }
                  />
                  <DetailValue
                    label="Возврат"
                    value={
                      operation.latestInstruction.returnRequestedAt
                        ? formatDate(
                            operation.latestInstruction.returnRequestedAt,
                          )
                        : operation.latestInstruction.returnedAt
                          ? formatDate(operation.latestInstruction.returnedAt)
                          : "—"
                    }
                  />
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Инструкция по операции еще не подготовлена.
                </div>
              )}
            </CardContent>
          </Card>

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
