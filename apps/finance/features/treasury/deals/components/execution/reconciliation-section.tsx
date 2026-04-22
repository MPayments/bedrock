"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import { buildDocumentCreateHref } from "@/features/documents/lib/routes";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { formatDate } from "@/lib/format";

type Exception =
  FinanceDealWorkbench["relatedResources"]["reconciliationExceptions"][number];
type ReconciliationSummary = FinanceDealWorkbench["reconciliationSummary"];

function getReconciliationStateLabel(value: ReconciliationSummary["state"]) {
  switch (value) {
    case "clear":
      return "Сверено";
    case "blocked":
      return "Расхождения";
    case "pending":
      return "В процессе";
    case "not_started":
      return "Не запускалось";
    default:
      return value;
  }
}

function getReconciliationStateVariant(
  value: ReconciliationSummary["state"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (value) {
    case "clear":
      return "default";
    case "blocked":
      return "destructive";
    case "pending":
      return "secondary";
    case "not_started":
    default:
      return "outline";
  }
}

function getExceptionStateLabel(state: Exception["state"]) {
  switch (state) {
    case "open":
      return "Открыто";
    case "resolved":
      return "Разрешено";
    case "ignored":
      return "Игнорируется";
    default:
      return state;
  }
}

export interface ExecutionReconciliationSectionProps {
  canRunReconciliation: boolean;
  dealId: string;
  exceptions: Exception[];
  executionTabReturnTo: string;
  ignoringExceptionId: string | null;
  isRunningReconciliation: boolean;
  onIgnoreReconciliationException: (exceptionId: string) => void;
  onRunReconciliation: () => void;
  summary: ReconciliationSummary;
}

export function ExecutionReconciliationSection({
  canRunReconciliation,
  dealId,
  exceptions,
  executionTabReturnTo,
  ignoringExceptionId,
  isRunningReconciliation,
  onIgnoreReconciliationException,
  onRunReconciliation,
  summary,
}: ExecutionReconciliationSectionProps) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-muted-foreground h-4 w-4" />
          <div className="text-sm font-semibold">Сверка</div>
          <Badge
            data-testid="finance-deal-reconciliation-state"
            variant={getReconciliationStateVariant(summary.state)}
          >
            {getReconciliationStateLabel(summary.state)}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-muted-foreground">
            Требуют сверки:{" "}
            <span className="text-foreground font-medium">
              {summary.requiredOperationCount}
            </span>
          </div>
          <div className="text-muted-foreground">
            Сверено:{" "}
            <span className="text-foreground font-medium">
              {summary.reconciledOperationCount}
            </span>
          </div>
          <div className="text-muted-foreground">
            Открытых исключений:{" "}
            <span className="text-foreground font-medium">
              {summary.openExceptionCount}
            </span>
          </div>
          {canRunReconciliation ? (
            <Button
              data-testid="finance-deal-run-reconciliation"
              size="sm"
              variant="outline"
              disabled={isRunningReconciliation}
              onClick={onRunReconciliation}
            >
              {isRunningReconciliation ? "Повторяем..." : "Повторить сверку"}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-2 p-4">
        {exceptions.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            По связанным операциям исключений сверки пока нет.
          </div>
        ) : (
          exceptions.map((exception) => (
            <div
              key={`${exception.id}:${exception.operationId}`}
              className="rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={exception.blocking ? "destructive" : "outline"}
                >
                  {getExceptionStateLabel(exception.state)}
                </Badge>
                <span className="text-sm font-medium">
                  {exception.reasonCode}
                </span>
                <span className="text-muted-foreground text-xs">
                  Источник: {exception.source} · Операция:{" "}
                  <span className="font-mono">{exception.operationId}</span>
                </span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                Создано: {formatDate(exception.createdAt)}
                {exception.resolvedAt
                  ? ` · Закрыто: ${formatDate(exception.resolvedAt)}`
                  : ""}
              </div>
              {exception.state === "open" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {exception.actions.adjustmentDocumentDocType ? (
                    <Button
                      data-testid={`finance-deal-reconciliation-exception-create-adjustment-${exception.id}`}
                      render={
                        <Link
                          href={
                            buildDocumentCreateHref(
                              exception.actions.adjustmentDocumentDocType,
                              {
                                dealId,
                                reconciliationExceptionId: exception.id,
                                returnTo: executionTabReturnTo,
                              },
                            ) ?? "/documents"
                          }
                        />
                      }
                      size="sm"
                      variant="outline"
                    >
                      Создать корректировочный документ
                    </Button>
                  ) : null}
                  {exception.actions.canIgnore ? (
                    <Button
                      data-testid={`finance-deal-reconciliation-exception-ignore-${exception.id}`}
                      size="sm"
                      variant="outline"
                      disabled={ignoringExceptionId === exception.id}
                      onClick={() =>
                        onIgnoreReconciliationException(exception.id)
                      }
                    >
                      {ignoringExceptionId === exception.id
                        ? "Игнорируем..."
                        : "Игнорировать"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
