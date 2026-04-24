"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

type Operation = FinanceDealWorkbench["relatedResources"]["operations"][number];
type Outcome = "failed" | "returned" | "settled";

export interface OperationLifecycleActionsProps {
  operation: Operation;
  onOpenArtifact?: (instructionId: string) => void;
  adminViewHref?: string;
}

type ActionKey =
  | "prepare"
  | "submit"
  | "retry"
  | "void"
  | "return"
  | "artifact"
  | `outcome:${Outcome}`;

type LifecycleAction = {
  key: ActionKey;
  label: string;
  pendingLabel: string;
  onRun: () => void | Promise<void>;
};

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

export function OperationLifecycleActions({
  operation,
  onOpenArtifact,
  adminViewHref,
}: OperationLifecycleActionsProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const instructionId = operation.latestInstruction?.id ?? null;

  async function runMutation(input: {
    actionKey: ActionKey;
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

  const availableActions: LifecycleAction[] = [];

  if (operation.actions.canPrepareInstruction) {
    availableActions.push({
      key: "prepare",
      label: "Подготовить",
      pendingLabel: "Подготавливаем...",
      onRun: () =>
        runMutation({
          actionKey: "prepare",
          body: {},
          successMessage: "Инструкция подготовлена",
          url: `/v1/treasury/operations/${encodeURIComponent(operation.id)}/instructions/prepare`,
        }),
    });
  }

  if (operation.actions.canSubmitInstruction && instructionId) {
    availableActions.push({
      key: "submit",
      label: "Отправить",
      pendingLabel: "Отправляем...",
      onRun: () =>
        runMutation({
          actionKey: "submit",
          body: {},
          successMessage: "Инструкция отправлена",
          url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/submit`,
        }),
    });
  }

  for (const outcome of operation.availableOutcomeTransitions) {
    if (!instructionId) continue;
    availableActions.push({
      key: `outcome:${outcome}`,
      label: getOutcomeLabel(outcome),
      pendingLabel: "Сохраняем...",
      onRun: () =>
        runMutation({
          actionKey: `outcome:${outcome}`,
          body: { outcome },
          successMessage: "Результат инструкции сохранён",
          url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/outcome`,
        }),
    });
  }

  if (operation.actions.canRetryInstruction && instructionId) {
    availableActions.push({
      key: "retry",
      label: "Повторить",
      pendingLabel: "Создаём...",
      onRun: () =>
        runMutation({
          actionKey: "retry",
          body: {},
          successMessage: "Повторная инструкция создана",
          url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/retry`,
        }),
    });
  }

  if (operation.actions.canRequestReturn && instructionId) {
    availableActions.push({
      key: "return",
      label: "Запросить возврат",
      pendingLabel: "Запрашиваем...",
      onRun: () =>
        runMutation({
          actionKey: "return",
          body: {},
          successMessage: "Возврат запрошен",
          url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/return`,
        }),
    });
  }

  if (operation.actions.canVoidInstruction && instructionId) {
    availableActions.push({
      key: "void",
      label: "Отменить",
      pendingLabel: "Отменяем...",
      onRun: () =>
        runMutation({
          actionKey: "void",
          body: {},
          successMessage: "Инструкция отменена",
          url: `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/void`,
        }),
    });
  }

  if (onOpenArtifact && instructionId) {
    availableActions.push({
      key: "artifact",
      label: "Прикрепить подтверждение",
      pendingLabel: "Прикрепить подтверждение",
      onRun: () => onOpenArtifact(instructionId),
    });
  }

  const primaryKey: ActionKey | null = (() => {
    const priorities: ActionKey[] = [
      "prepare",
      "submit",
      "outcome:settled",
      "retry",
      "artifact",
      "outcome:returned",
      "outcome:failed",
    ];
    for (const key of priorities) {
      if (availableActions.some((a) => a.key === key)) return key;
    }
    return availableActions[0]?.key ?? null;
  })();

  const ghostKey: ActionKey | null = (() => {
    if (!primaryKey) return null;
    const ghostByPrimary: Partial<Record<ActionKey, ActionKey[]>> = {
      submit: ["void"],
      "outcome:settled": ["artifact", "outcome:failed"],
      retry: ["return", "outcome:failed"],
      prepare: ["void"],
    };
    const candidates = ghostByPrimary[primaryKey] ?? [];
    for (const key of candidates) {
      if (key === primaryKey) continue;
      if (availableActions.some((a) => a.key === key)) return key;
    }
    return null;
  })();

  const primary = availableActions.find((a) => a.key === primaryKey);
  const ghost =
    ghostKey !== null
      ? availableActions.find((a) => a.key === ghostKey)
      : undefined;
  const menuItems = availableActions.filter(
    (a) => a.key !== primary?.key && a.key !== ghost?.key,
  );

  if (!primary && !ghost && menuItems.length === 0 && !adminViewHref) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`finance-deal-operation-lifecycle-${operation.id}`}
    >
      {primary ? (
        <Button
          data-testid={`finance-deal-operation-primary-${operation.id}`}
          size="sm"
          disabled={activeAction === primary.key}
          onClick={() => void primary.onRun()}
        >
          {activeAction === primary.key ? primary.pendingLabel : primary.label}
        </Button>
      ) : null}

      {ghost ? (
        <Button
          data-testid={`finance-deal-operation-ghost-${operation.id}`}
          size="sm"
          variant="outline"
          disabled={activeAction === ghost.key}
          onClick={() => void ghost.onRun()}
        >
          {activeAction === ghost.key ? ghost.pendingLabel : ghost.label}
        </Button>
      ) : null}

      {menuItems.length > 0 || adminViewHref ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="ghost"
                data-testid={`finance-deal-operation-menu-${operation.id}`}
                aria-label="Дополнительные действия"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {menuItems.map((action) => (
              <DropdownMenuItem
                key={action.key}
                data-testid={`finance-deal-operation-menu-item-${action.key}-${operation.id}`}
                disabled={activeAction === action.key}
                onClick={() => void action.onRun()}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
            {menuItems.length > 0 && adminViewHref ? (
              <DropdownMenuSeparator />
            ) : null}
            {adminViewHref ? (
              <DropdownMenuItem
                render={<a href={adminViewHref}>Админ-вид инструкции</a>}
                data-testid={`finance-deal-operation-menu-admin-${operation.id}`}
              />
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
