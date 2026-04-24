"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, TriangleAlert } from "lucide-react";

import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import {
  buildAmendRouteBody,
  type AmendFieldValues,
} from "../lib/step-helpers";
import { useDebouncedCallback } from "../lib/use-debounced-callback";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  if (trimmed === "0") return null;
  return trimmed.replace(/^0+/, "") || "0";
}

const MUTABLE_STATES: ReadonlySet<FinanceDealPaymentStep["state"]> = new Set([
  "draft",
  "scheduled",
  "pending",
]);

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface StepRouteEditorProps {
  step: FinanceDealPaymentStep;
  /**
   * Debounce window for inline edits. Defaults to 500ms which keeps the
   * network quiet without feeling laggy.
   */
  debounceMs?: number;
  /** Called after an amend succeeds (e.g. workbench router.refresh). */
  onAmended?: () => void;
  disabled?: boolean;
}

export function StepRouteEditor({
  debounceMs = 500,
  disabled,
  onAmended,
  step,
}: StepRouteEditorProps) {
  const isEditable = MUTABLE_STATES.has(step.state) && !disabled;

  const initialValues = useMemo<AmendFieldValues>(
    () => ({
      fromAmountMinor: step.fromAmountMinor,
      fromCurrencyId: step.fromCurrencyId,
      fromRequisiteId: step.fromParty.requisiteId,
      rate: step.rate,
      toAmountMinor: step.toAmountMinor,
      toCurrencyId: step.toCurrencyId,
      toRequisiteId: step.toParty.requisiteId,
    }),
    [step],
  );

  const [values, setValues] = useState<AmendFieldValues>(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Reset local state whenever the underlying step revision rolls (e.g. after
  // a router.refresh triggered by another action). Otherwise we'd keep stale
  // "dirty" values.
  useEffect(() => {
    setValues(initialValues);
    setStatus("idle");
  }, [initialValues]);

  async function save(next: AmendFieldValues) {
    const body = buildAmendRouteBody({ after: next, before: initialValues });
    if (!body) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    const result = await executeMutation({
      fallbackMessage: "Не удалось сохранить правку",
      request: () =>
        fetch(`/v1/treasury/steps/${encodeURIComponent(step.id)}/amend`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify(body),
        }),
    });

    if (!result.ok) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    if (onAmended) onAmended();
  }

  const debouncedSave = useDebouncedCallback(save, debounceMs);

  function updateField<K extends keyof AmendFieldValues>(
    key: K,
    value: AmendFieldValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      debouncedSave(next);
      return next;
    });
  }

  return (
    <div
      className="border-muted bg-muted/20 space-y-3 rounded-md border px-4 py-3"
      data-testid={`finance-step-route-editor-${step.id}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-3 gap-y-3">
        <div className="space-y-2">
          <Label>Отправитель</Label>
          <div className="text-sm font-medium">{step.fromParty.id}</div>
          <div className="text-muted-foreground text-xs">
            {step.fromParty.requisiteId ?? "Реквизит не задан"}
          </div>
        </div>

        <ArrowRight className="text-muted-foreground mb-2 h-4 w-4 shrink-0 self-end" />

        <div className="space-y-2">
          <Label>Получатель</Label>
          <div className="text-sm font-medium">{step.toParty.id}</div>
          <div className="text-muted-foreground text-xs">
            {step.toParty.requisiteId ?? "Реквизит не задан"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <div className="space-y-2">
          <Label htmlFor={`step-${step.id}-from-amount`}>
            Сумма отправителя (minor)
          </Label>
          <Input
            id={`step-${step.id}-from-amount`}
            inputMode="numeric"
            placeholder="0"
            disabled={!isEditable}
            value={values.fromAmountMinor ?? ""}
            onChange={(event) =>
              updateField(
                "fromAmountMinor",
                normalizeAmount(event.target.value),
              )
            }
            data-testid={`finance-step-from-amount-${step.id}`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`step-${step.id}-to-amount`}>
            Сумма получателя (minor)
          </Label>
          <Input
            id={`step-${step.id}-to-amount`}
            inputMode="numeric"
            placeholder="0"
            disabled={!isEditable}
            value={values.toAmountMinor ?? ""}
            onChange={(event) =>
              updateField(
                "toAmountMinor",
                normalizeAmount(event.target.value),
              )
            }
            data-testid={`finance-step-to-amount-${step.id}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs">
        {status === "saving" ? (
          <span
            className="text-muted-foreground inline-flex items-center gap-1"
            data-testid={`finance-step-route-status-saving-${step.id}`}
          >
            <Loader2 className="size-3 animate-spin" /> Сохраняем...
          </span>
        ) : null}
        {status === "saved" ? (
          <span
            className="text-emerald-600 inline-flex items-center gap-1"
            data-testid={`finance-step-route-status-saved-${step.id}`}
          >
            <Check className="size-3" /> Сохранено
          </span>
        ) : null}
        {status === "error" ? (
          <span
            className="text-destructive inline-flex items-center gap-1"
            data-testid={`finance-step-route-status-error-${step.id}`}
          >
            <TriangleAlert className="size-3" /> Не сохранилось
          </span>
        ) : null}
      </div>
    </div>
  );
}
