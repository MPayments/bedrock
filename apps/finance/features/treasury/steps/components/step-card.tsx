"use client";

import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";

import type { PartyKind } from "../lib/party-options";
import {
  deriveStepPrimaryAction,
  type StepConfirmOutcome,
} from "../lib/step-helpers";
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
  /**
   * Called after any successful mutation. Receives the step at the moment of
   * change so the parent can run post-hooks (e.g. auto-linking newly
   * appeared posting documents) before its own refresh.
   */
  onChanged?: (step: FinanceDealPaymentStep) => void;
  /**
   * Short headline shown in the card header (e.g. "Шаг 2 · Конверсия").
   * Parent supplies it because only the parent knows the deal/leg context
   * (role labels, step position in the route).
   */
  title?: string;
  /**
   * Optional party kinds per side — when provided the route editor turns
   * party and requisite pickers into live Selects. Parent derives this from
   * the deal's route-attachment participants (for `deal_leg` steps).
   */
  fromPartyKind?: PartyKind | null;
  toPartyKind?: PartyKind | null;
  /**
   * Display names / currency codes for the route editor so the user sees
   * `ARABIAN FUEL ALLIANCE DMCC` / `USD 125,00` instead of raw UUIDs and
   * minor-unit integers. Parent resolves these from its rich deal context.
   */
  fromPartyDisplayName?: string | null;
  toPartyDisplayName?: string | null;
  fromCurrencyCode?: string | null;
  toCurrencyCode?: string | null;
  disabled?: boolean;
}

export function StepCard({
  adminViewHref,
  disabled,
  fromCurrencyCode = null,
  fromPartyDisplayName = null,
  fromPartyKind = null,
  onChanged,
  step,
  title,
  toCurrencyCode = null,
  toPartyDisplayName = null,
  toPartyKind = null,
  uploadAssetPath,
}: StepCardProps) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitialOutcome, setConfirmInitialOutcome] =
    useState<StepConfirmOutcome>("settled");
  const [historyOpen, setHistoryOpen] = useState(false);

  const primaryAction = deriveStepPrimaryAction(step.state);

  function handleSuccess() {
    if (onChanged) onChanged(step);
  }

  function openConfirmDialog(outcome: StepConfirmOutcome) {
    setConfirmInitialOutcome(outcome);
    setConfirmOpen(true);
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
          fromCurrencyCode={fromCurrencyCode}
          fromPartyDisplayName={fromPartyDisplayName}
          fromPartyKind={fromPartyKind}
          toCurrencyCode={toCurrencyCode}
          toPartyDisplayName={toPartyDisplayName}
          toPartyKind={toPartyKind}
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
              onClick={() => openConfirmDialog("settled")}
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
            onMarkReturned={() => openConfirmDialog("returned")}
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
        initialOutcome={confirmInitialOutcome}
      />

      <StepAttemptsDrawer
        step={step}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </section>
  );
}
