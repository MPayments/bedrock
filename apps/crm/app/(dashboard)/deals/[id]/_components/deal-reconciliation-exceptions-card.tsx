import { AlertCircle, ArrowRightLeft } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatDate } from "./format";
import type { ApiCrmDealWorkbenchProjection } from "./types";

type DealReconciliationExceptionsCardProps = {
  reconciliationExceptions: ApiCrmDealWorkbenchProjection["relatedResources"]["reconciliationExceptions"];
  reconciliationSummary: ApiCrmDealWorkbenchProjection["reconciliationSummary"];
};

function getReconciliationStateLabel(value: string) {
  switch (value) {
    case "blocked":
      return "Есть исключения";
    case "clear":
      return "Сверка завершена";
    case "not_started":
      return "Сверка не требуется";
    case "pending":
      return "Сверка ожидается";
    default:
      return value;
  }
}

function getReconciliationStateVariant(value: string) {
  switch (value) {
    case "blocked":
      return "destructive" as const;
    case "clear":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "not_started":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function getExceptionStateLabel(value: string) {
  switch (value) {
    case "open":
      return "Открыто";
    case "resolved":
      return "Разрешено";
    case "ignored":
      return "Игнорируется";
    default:
      return value;
  }
}

export function DealReconciliationExceptionsCard({
  reconciliationExceptions,
  reconciliationSummary,
}: DealReconciliationExceptionsCardProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Сверка и исключения
            </CardTitle>
            <CardDescription>
              Состояние matched operations и исключений, которые мешают
              закрытию сделки.
            </CardDescription>
          </div>
          <Badge variant={getReconciliationStateVariant(reconciliationSummary.state)}>
            {getReconciliationStateLabel(reconciliationSummary.state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Требуют сверки
            </div>
            <div className="mt-1 text-lg font-semibold">
              {reconciliationSummary.requiredOperationCount}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Сверено
            </div>
            <div className="mt-1 text-lg font-semibold">
              {reconciliationSummary.reconciledOperationCount}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Открытых исключений
            </div>
            <div className="mt-1 text-lg font-semibold">
              {reconciliationSummary.openExceptionCount}
            </div>
          </div>
        </div>

        {reconciliationExceptions.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            По связанным операциям исключений сверки сейчас нет.
          </div>
        ) : (
          <div className="space-y-3">
            {reconciliationExceptions.map((exception) => (
              <div
                key={`${exception.id}:${exception.operationId}`}
                className="rounded-lg border px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={exception.blocking ? "destructive" : "outline"}>
                    {getExceptionStateLabel(exception.state)}
                  </Badge>
                  <span className="text-sm font-medium">
                    {exception.reasonCode}
                  </span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Источник: {exception.source} · Внешняя запись:{" "}
                  {exception.externalRecordId}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Операция: {exception.operationId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Создано: {formatDate(exception.createdAt)}
                  {exception.resolvedAt
                    ? ` · Закрыто: ${formatDate(exception.resolvedAt)}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {reconciliationSummary.state === "blocked" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>
                Пока есть открытые исключения сверки, сделка не считается
                готовой к закрытию.
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
