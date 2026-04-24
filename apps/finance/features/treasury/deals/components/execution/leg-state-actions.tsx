"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

type Leg = FinanceDealWorkbench["executionPlan"][number];

export interface LegStateActionsProps {
  dealId: string;
  leg: Leg;
  disabled?: boolean;
}

type ManualOverride = "blocked" | "skipped" | null;

const OVERRIDE_LABELS: Record<"blocked" | "skipped", string> = {
  blocked: "Заблокировать",
  skipped: "Пропустить",
};

// Leg state is a projection of instruction + document state; the only
// user-driven writes are the safety-valve overrides. `Заблокировать` marks a
// leg as operator-halted; `Пропустить` excludes the leg from further
// automation. Both hit the same /override endpoint and are reversible via
// «Устранить блокер» (which clears the override elsewhere in the editor).
function availableOverrides(currentState: string): ("blocked" | "skipped")[] {
  if (currentState === "done" || currentState === "skipped") {
    // Terminal: no safety-valve remains. (A `done` leg is derived from
    // settled instructions + posted docs; to reopen it, the underlying
    // instruction would need to move.)
    return [];
  }
  if (currentState === "blocked") {
    // Already blocked — only "skip" remains as a hard-out; unblock lives
    // on the "Устранить блокер" button in the leg editor.
    return ["skipped"];
  }
  return ["blocked", "skipped"];
}

export function LegStateActions({
  dealId,
  leg,
  disabled,
}: LegStateActionsProps) {
  const router = useRouter();
  const [activeOverride, setActiveOverride] = useState<ManualOverride>(null);
  const overrides = availableOverrides(leg.state);

  if (overrides.length === 0 || !leg.id) return null;

  async function runOverride(override: "blocked" | "skipped") {
    setActiveOverride(override);
    const result = await executeMutation({
      fallbackMessage: "Не удалось изменить статус шага",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(dealId)}/legs/${leg.idx}/override`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ override }),
          },
        ),
    });
    setActiveOverride(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(`Шаг ${leg.idx}: ${OVERRIDE_LABELS[override]}`);
    router.refresh();
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`finance-deal-leg-state-actions-${leg.idx}`}
    >
      {overrides.map((override) => {
        const isActive = activeOverride === override;
        return (
          <Button
            key={override}
            data-testid={`finance-deal-leg-override-${leg.idx}-${override}`}
            size="sm"
            variant="outline"
            disabled={disabled || isActive}
            onClick={() => runOverride(override)}
          >
            {isActive ? "Применяем..." : OVERRIDE_LABELS[override]}
          </Button>
        );
      })}
    </div>
  );
}
