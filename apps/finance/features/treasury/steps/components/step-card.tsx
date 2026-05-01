"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import type { PartyKind, PartyKindOrSnapshot } from "../lib/party-options";
import {
  deriveStepPrimaryAction,
  getStepKindLabel,
  STEP_PURPOSE_LABELS,
  type StepConfirmOutcome,
} from "../lib/step-helpers";
import { StepAttemptsDrawer } from "./step-attempts-drawer";
import { StepConfirmDialog } from "./step-confirm-dialog";
import { StepOverflowMenu } from "./step-overflow-menu";
import { StepRouteEditor } from "./step-route-editor";
import { StepStateBadge } from "./step-state-badge";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  kindLabel?: string;
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
  kindLabel,
  onChanged,
  step,
  title,
  toPartyDisplayName = null,
  toPartyKind = null,
  uploadAssetPath,
}: StepCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitialOutcome, setConfirmInitialOutcome] =
    useState<StepConfirmOutcome>("settled");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmitStep() {
    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось отметить шаг отправленным",
      request: () =>
        fetch(`/v1/treasury/steps/${encodeURIComponent(step.id)}/submit`, {
          body: JSON.stringify({}),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        }),
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(
      step.state === "failed"
        ? "Повторная отправка отмечена"
        : "Шаг направлен в исполнение",
    );

    if (onChanged) {
      onChanged(step);
    } else {
      router.refresh();
    }
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
              {kindLabel ?? getStepKindLabel(step)} ·{" "}
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
            onClick={handleSubmitStep}
            disabled={disabled || isSubmitting}
            data-testid={`finance-step-primary-submit-${step.id}`}
          >
            {isSubmitting ? (
              <>
                <Spinner data-icon="inline-start" />
                Направляем...
              </>
            ) : step.state === "failed" ? (
              "Отправить повторно"
            ) : (
              "Направить в исполнение"
            )}
          </Button>
        ) : null}

        {primaryAction === "confirm" ? (
          <Button
            onClick={() => openConfirmDialog("settled")}
            disabled={disabled}
            data-testid={`finance-step-primary-confirm-${step.id}`}
          >
            Подтвердить исполнение
          </Button>
        ) : null}

        <StepOverflowMenu
          step={step}
          adminViewHref={adminViewHref}
          disabled={disabled || isSubmitting}
          onChanged={handleSuccess}
          onMarkReturned={() => openConfirmDialog("returned")}
          onOpenHistory={() => setHistoryOpen(true)}
          onRetry={handleSubmitStep}
        />
      </footer>

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
