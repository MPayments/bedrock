"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

type Operation = FinanceDealWorkbench["relatedResources"]["operations"][number];
type Outcome = "failed" | "returned" | "settled";

export interface OperationLifecycleActionsProps {
  operation: Operation;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOutcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case "settled":
      return "Отметить исполненной";
    case "failed":
      return "Отметить с ошибкой";
    case "returned":
      return "Подтвердить возврат";
  }
}

function getOutcomeVariant(
  outcome: Outcome,
): "default" | "outline" | "destructive" {
  switch (outcome) {
    case "settled":
      return "default";
    case "failed":
      return "destructive";
    case "returned":
      return "outline";
  }
}

export function OperationLifecycleActions({
  operation,
}: OperationLifecycleActionsProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const instructionId = operation.latestInstruction?.id ?? null;

  const hasLifecycleAction =
    operation.actions.canPrepareInstruction ||
    (operation.actions.canSubmitInstruction && instructionId) ||
    (operation.actions.canRetryInstruction && instructionId) ||
    (operation.actions.canVoidInstruction && instructionId) ||
    (operation.actions.canRequestReturn && instructionId) ||
    (operation.availableOutcomeTransitions.length > 0 && instructionId);

  if (!hasLifecycleAction) return null;

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
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`finance-deal-operation-lifecycle-${operation.id}`}
    >
      {operation.actions.canPrepareInstruction ? (
        <Button
          data-testid={`finance-deal-operation-prepare-${operation.id}`}
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
          data-testid={`finance-deal-operation-submit-${operation.id}`}
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

      {operation.availableOutcomeTransitions.map((outcome) =>
        instructionId ? (
          <Button
            key={outcome}
            data-testid={`finance-deal-operation-outcome-${outcome}-${operation.id}`}
            size="sm"
            variant={getOutcomeVariant(outcome)}
            disabled={activeAction === `outcome:${outcome}`}
            onClick={() =>
              runAction({
                actionKey: `outcome:${outcome}`,
                body: { outcome },
                successMessage: "Результат инструкции сохранён",
                url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/outcome`,
              })
            }
          >
            {activeAction === `outcome:${outcome}`
              ? "Сохраняем..."
              : getOutcomeLabel(outcome)}
          </Button>
        ) : null,
      )}

      {operation.actions.canRetryInstruction && instructionId ? (
        <Button
          data-testid={`finance-deal-operation-retry-${operation.id}`}
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
          {activeAction === "retry" ? "Создаём..." : "Повторить"}
        </Button>
      ) : null}

      {operation.actions.canVoidInstruction && instructionId ? (
        <Button
          data-testid={`finance-deal-operation-void-${operation.id}`}
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
          data-testid={`finance-deal-operation-return-${operation.id}`}
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
          {activeAction === "return" ? "Запрашиваем..." : "Запросить возврат"}
        </Button>
      ) : null}
    </div>
  );
}
