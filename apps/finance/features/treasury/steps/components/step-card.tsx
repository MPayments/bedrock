"use client";

import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";

import type { PartyKind, PartyKindOrSnapshot } from "../lib/party-options";
import {
  deriveStepPrimaryAction,
  STEP_KIND_LABELS,
  STEP_PURPOSE_LABELS,
  type StepConfirmOutcome,
} from "../lib/step-helpers";
import { StepAttemptsDrawer } from "./step-attempts-drawer";
import { StepConfirmDialog } from "./step-confirm-dialog";
import { StepOverflowMenu } from "./step-overflow-menu";
import { StepRouteEditor } from "./step-route-editor";
import { StepStateBadge } from "./step-state-badge";
import { StepSubmitDialog } from "./step-submit-dialog";

function narrowPartyKind(
  kind: PartyKindOrSnapshot | null | undefined,
): PartyKind | null {
  if (
    kind === "organization" ||
    kind === "counterparty" ||
    kind === "customer"
  ) {
    return kind;
  }
  return null;
}

function partyKindFromEntityKind(
  entityKind: string | null | undefined,
): PartyKindOrSnapshot | null {
  if (
    entityKind === "organization" ||
    entityKind === "counterparty" ||
    entityKind === "customer"
  ) {
    return entityKind;
  }
  if (entityKind === "external_beneficiary_snapshot") {
    return "beneficiary_snapshot";
  }
  return null;
}

export interface StepCardProps {
  step: FinanceDealPaymentStep;
  uploadAssetPath?: string;
  adminViewHref?: string;
  onChanged?: (step: FinanceDealPaymentStep) => void;
  title?: string;
  fromPartyKind?: PartyKindOrSnapshot | null;
  toPartyKind?: PartyKindOrSnapshot | null;
  fromPartyDisplayName?: string | null;
  toPartyDisplayName?: string | null;
  disabled?: boolean;
}

export function StepCard({
  adminViewHref,
  disabled,
  fromPartyDisplayName = null,
  fromPartyKind = null,
  onChanged,
  step,
  title,
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
  const effectiveFromPartyKind =
    fromPartyKind ?? partyKindFromEntityKind(step.fromParty.entityKind);
  const effectiveToPartyKind =
    toPartyKind ?? partyKindFromEntityKind(step.toParty.entityKind);
  const effectiveFromPartyDisplayName =
    fromPartyDisplayName ?? step.fromParty.displayName ?? null;
  const effectiveToPartyDisplayName =
    toPartyDisplayName ?? step.toParty.displayName ?? null;

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
              {STEP_KIND_LABELS[step.kind]} ·{" "}
              {STEP_PURPOSE_LABELS[step.purpose]}
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
          fromPartyDisplayName={effectiveFromPartyDisplayName}
          fromPartyKind={narrowPartyKind(effectiveFromPartyKind)}
          toPartyDisplayName={effectiveToPartyDisplayName}
          toPartyKind={narrowPartyKind(effectiveToPartyKind)}
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
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
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
          onRetry={() => setSubmitOpen(true)}
        />
      </footer>

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
