"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  getDealLegStateLabel,
  getFinanceLegStateTransitions,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

type Leg = FinanceDealWorkbench["executionPlan"][number];

export interface LegStateActionsProps {
  dealId: string;
  leg: Leg;
  disabled?: boolean;
}

const FORWARD_STATE_LABELS: Record<string, string> = {
  ready: "К готовности",
  in_progress: "В работу",
  done: "Завершить",
};

const SECONDARY_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокировать",
  skipped: "Пропустить",
};

type StateCategory = "forward" | "secondary";

function categorize(state: string): StateCategory {
  return state in FORWARD_STATE_LABELS ? "forward" : "secondary";
}

function getStateLabel(state: string): string {
  return (
    FORWARD_STATE_LABELS[state] ??
    SECONDARY_STATE_LABELS[state] ??
    getDealLegStateLabel(state)
  );
}

export function LegStateActions({ dealId, leg, disabled }: LegStateActionsProps) {
  const router = useRouter();
  const [activeState, setActiveState] = useState<string | null>(null);
  const transitions = getFinanceLegStateTransitions(leg.state);

  if (transitions.length === 0 || !leg.id) return null;

  async function runTransition(nextState: string) {
    setActiveState(nextState);
    const result = await executeMutation({
      fallbackMessage: "Не удалось изменить статус шага",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(dealId)}/legs/${leg.idx}/state`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: nextState }),
          },
        ),
    });
    setActiveState(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(`Шаг ${leg.idx}: ${getStateLabel(nextState)}`);
    router.refresh();
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`finance-deal-leg-state-actions-${leg.idx}`}
    >
      {transitions.map((nextState) => {
        const category = categorize(nextState);
        const isActive = activeState === nextState;
        return (
          <Button
            key={nextState}
            data-testid={`finance-deal-leg-transition-${leg.idx}-${nextState}`}
            size="sm"
            variant={category === "forward" ? "default" : "outline"}
            disabled={disabled || isActive}
            onClick={() => runTransition(nextState)}
          >
            {isActive ? "Применяем..." : getStateLabel(nextState)}
          </Button>
        );
      })}
    </div>
  );
}
