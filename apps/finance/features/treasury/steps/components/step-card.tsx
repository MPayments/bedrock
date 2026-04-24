"use client";

import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";

import { deriveStepPrimaryAction } from "../lib/step-helpers";
import { StepAttemptsDrawer } from "./step-attempts-drawer";
import { StepConfirmDialog } from "./step-confirm-dialog";
import { StepOverflowMenu } from "./step-overflow-menu";
import { StepRouteEditor } from "./step-route-editor";
import { StepStateBadge } from "./step-state-badge";
import { StepSubmitDialog } from "./step-submit-dialog";

export interface StepCardProps {
  step: FinanceDealPaymentStep;
  /**
   * Optional upload endpoint for the confirm dialog. Omit to disable the
   * file-upload control — useful for standalone/draft steps where there is
   * no owning deal yet.
   */
  uploadAssetPath?: string;
  /** Admin href (e.g. `/treasury/operations/{operationId}`) for overflow. */
  adminViewHref?: string;
  /** Called after any successful mutation to refresh the parent. */
  onChanged?: () => void;
  /**
   * Short headline shown in the card header (e.g. "Шаг 2 · Конверсия").
   * Parent supplies it because only the parent knows the deal/leg context
   * (role labels, step position in the route).
   */
  title?: string;
  disabled?: boolean;
}

export function StepCard({
  adminViewHref,
  disabled,
  onChanged,
  step,
  title,
  uploadAssetPath,
}: StepCardProps) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const primaryAction = deriveStepPrimaryAction(step.state);

  function handleSuccess() {
    if (onChanged) onChanged();
  }

  return (
    <section
      className="bg-card rounded-lg border"
      data-testid={`finance-step-card-${step.id}`}
    >
      <header className="flex flex-col gap-3 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? (
              <div className="text-sm font-semibold">{title}</div>
            ) : null}
            <div className="text-muted-foreground text-xs">
              {step.kind} · {step.purpose}
            </div>
          </div>
          <StepStateBadge
            state={step.state}
            data-testid={`finance-step-state-${step.id}`}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <StepRouteEditor
          step={step}
          disabled={disabled}
          onAmended={handleSuccess}
        />

        {step.failureReason ? (
          <div
            className="text-destructive rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm"
            data-testid={`finance-step-failure-reason-${step.id}`}
          >
            <div className="font-medium">Причина ошибки</div>
            <div>{step.failureReason}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {primaryAction === "submit" ? (
            <Button
              onClick={() => setSubmitOpen(true)}
              disabled={disabled}
              data-testid={`finance-step-primary-submit-${step.id}`}
            >
              {step.state === "failed" ? "Отправить повторно" : "Отправить"}
            </Button>
          ) : null}

          {primaryAction === "confirm" ? (
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={disabled}
              data-testid={`finance-step-primary-confirm-${step.id}`}
            >
              Подтвердить
            </Button>
          ) : null}

          <StepOverflowMenu
            step={step}
            adminViewHref={adminViewHref}
            disabled={disabled}
            onChanged={handleSuccess}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        </div>
      </div>

      <StepSubmitDialog
        step={step}
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSuccess={handleSuccess}
      />

      <StepConfirmDialog
        step={step}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onSuccess={handleSuccess}
        uploadAssetPath={uploadAssetPath}
      />

      <StepAttemptsDrawer
        step={step}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </section>
  );
}
