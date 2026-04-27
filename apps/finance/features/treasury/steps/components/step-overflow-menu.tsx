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

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type MenuAction =
  | "cancel"
  | "skip"
  | "retry"
  | "open-history"
  | "mark-returned";

const MENU_ACTION_LABELS: Record<MenuAction, string> = {
  cancel: "Отменить шаг",
  skip: "Пропустить шаг",
  retry: "Повторить",
  "open-history": "История попыток",
  "mark-returned": "Зафиксировать возврат",
};

const MENU_ACTION_PENDING_LABELS: Record<MenuAction, string> = {
  cancel: "Отменяем...",
  skip: "Пропускаем...",
  retry: "Открываем...",
  "open-history": "История попыток",
  "mark-returned": "Зафиксировать возврат",
};

const MUTABLE_STATES: ReadonlySet<FinanceDealPaymentStep["state"]> = new Set([
  "draft",
  "scheduled",
  "pending",
]);

export interface StepOverflowMenuProps {
  step: FinanceDealPaymentStep;
  onOpenHistory: () => void;
  onMarkReturned?: () => void;
  onRetry?: () => void;
  onChanged?: () => void;
  adminViewHref?: string;
  disabled?: boolean;
}

export function StepOverflowMenu({
  adminViewHref,
  disabled,
  onChanged,
  onMarkReturned,
  onOpenHistory,
  onRetry,
  step,
}: StepOverflowMenuProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<MenuAction | null>(null);

  const canCancel = MUTABLE_STATES.has(step.state);
  const canSkip = MUTABLE_STATES.has(step.state);
  const canRetrySubmit = step.state === "failed";
  const canMarkReturned = step.state === "completed" && Boolean(onMarkReturned);
  const hasHistory = step.attempts.length > 0;

  async function postMutation(
    path: string,
    action: MenuAction,
    successMessage: string,
  ) {
    setActiveAction(action);
    const result = await executeMutation({
      fallbackMessage: "Не удалось изменить статус шага",
      request: () =>
        fetch(path, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({}),
        }),
    });
    setActiveAction(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(successMessage);
    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  }

  const menuItems: { action: MenuAction; onSelect: () => void }[] = [];

  if (canCancel) {
    menuItems.push({
      action: "cancel",
      onSelect: () =>
        postMutation(
          `/v1/treasury/steps/${encodeURIComponent(step.id)}/cancel`,
          "cancel",
          "Шаг отменён",
        ),
    });
  }

  if (canSkip) {
    menuItems.push({
      action: "skip",
      onSelect: () =>
        postMutation(
          `/v1/treasury/steps/${encodeURIComponent(step.id)}/skip`,
          "skip",
          "Шаг пропущен",
        ),
    });
  }

  if (canRetrySubmit && onRetry) {
    menuItems.push({
      action: "retry",
      onSelect: onRetry,
    });
  }

  if (canMarkReturned && onMarkReturned) {
    menuItems.push({
      action: "mark-returned",
      onSelect: onMarkReturned,
    });
  }

  if (hasHistory) {
    menuItems.push({
      action: "open-history",
      onSelect: onOpenHistory,
    });
  }

  if (menuItems.length === 0 && !adminViewHref) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            aria-label="Дополнительные действия"
            data-testid={`finance-step-menu-${step.id}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {menuItems.map((item) => (
          <DropdownMenuItem
            key={item.action}
            disabled={activeAction === item.action}
            onClick={item.onSelect}
            data-testid={`finance-step-menu-item-${item.action}-${step.id}`}
          >
            {activeAction === item.action
              ? MENU_ACTION_PENDING_LABELS[item.action]
              : MENU_ACTION_LABELS[item.action]}
          </DropdownMenuItem>
        ))}
        {menuItems.length > 0 && adminViewHref ? (
          <DropdownMenuSeparator />
        ) : null}
        {adminViewHref ? (
          <DropdownMenuItem
            render={<a href={adminViewHref}>Админ-вид операции</a>}
            data-testid={`finance-step-menu-admin-${step.id}`}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
