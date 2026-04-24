"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  EXECUTION_AMENDMENT_REASONS,
  ExecutionAmendmentReasonSchema,
  type ExecutionAmendmentReason,
} from "@bedrock/deals/contracts";

import type {
  FinanceDealRouteAttachmentParticipant,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";
import {
  listCandidateCounterparties,
  listCandidateOrganizations,
  listRequisitesForOwner,
  type EntityOption,
  type RequisiteOption,
} from "@/features/treasury/deals/lib/leg-edit-queries";
import { executeMutation } from "@/lib/resources/http";

type Leg = FinanceDealWorkbench["executionPlan"][number];

const REASON_LABELS: Record<ExecutionAmendmentReason, string> = {
  typo_correction: "Опечатка",
  counterparty_unavailable: "Контрагент недоступен",
  requisite_invalid: "Недействительный реквизит",
  intermediary_swap: "Смена посредника",
  fee_correction: "Корректировка комиссии",
  other: "Другое",
};

const REASON_OPTIONS: ReadonlyArray<{
  value: ExecutionAmendmentReason;
  label: string;
}> = [
  { value: "typo_correction", label: REASON_LABELS.typo_correction },
  ...EXECUTION_AMENDMENT_REASONS.filter(
    (code): code is ExecutionAmendmentReason => code !== "typo_correction",
  ).map((value) => ({ value, label: REASON_LABELS[value] })),
];

const LegEditorFormSchema = z.object({
  entityId: z.string().uuid().nullable(),
  requisiteId: z.string().uuid().nullable(),
  reasonCode: ExecutionAmendmentReasonSchema,
});

type LegEditorFormValues = z.infer<typeof LegEditorFormSchema>;

type ParticipantEntityKind = "customer" | "organization" | "counterparty";
type EditableEntityKind = "organization" | "counterparty";

function isEditableKind(
  kind: ParticipantEntityKind | null,
): kind is EditableEntityKind {
  return kind === "organization" || kind === "counterparty";
}

function resolveLegDestinationParticipant(
  deal: FinanceDealWorkbench,
  leg: Leg,
): FinanceDealRouteAttachmentParticipant | null {
  const attachment = deal.pricing.routeAttachment;
  if (!attachment) return null;
  return attachment.participants[leg.idx] ?? null;
}

function resolveLegSourceParticipant(
  deal: FinanceDealWorkbench,
  leg: Leg,
): FinanceDealRouteAttachmentParticipant | null {
  const attachment = deal.pricing.routeAttachment;
  if (!attachment) return null;
  return attachment.participants[leg.idx - 1] ?? null;
}

function getLegTargetCurrencyId(leg: Leg): string | null {
  return leg.toCurrencyId ?? null;
}

function isDealTerminal(
  status: FinanceDealWorkbench["summary"]["status"],
): boolean {
  return (
    status === "draft" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "done"
  );
}

export interface LegParticipantEditorProps {
  canWrite: boolean;
  deal: FinanceDealWorkbench;
  leg: Leg;
  onAmended: () => void;
}

export function LegParticipantEditor({
  canWrite,
  deal,
  leg,
  onAmended,
}: LegParticipantEditorProps) {
  const sourceParticipant = resolveLegSourceParticipant(deal, leg);
  const destParticipant = resolveLegDestinationParticipant(deal, leg);
  const hasRouteBinding = Boolean(sourceParticipant || destParticipant);

  const targetCurrencyId = getLegTargetCurrencyId(leg);
  const dealTerminal = isDealTerminal(deal.summary.status);
  const legTerminal = leg.state === "done" || leg.state === "skipped";
  const editableDisabled = !canWrite || dealTerminal || legTerminal;

  const destIsCustomer = destParticipant?.entityKind === "customer";
  const destEditableKind: EditableEntityKind | null =
    destParticipant && isEditableKind(destParticipant.entityKind)
      ? destParticipant.entityKind
      : null;
  const canEditDestEntity = Boolean(destEditableKind) && !editableDisabled;
  const canEditDestRequisite =
    Boolean(destParticipant) && !destIsCustomer && !editableDisabled;

  const initialEntityId = destParticipant?.entityId ?? null;
  const initialRequisiteId = destParticipant?.requisiteId ?? null;

  const defaultValues = useMemo<LegEditorFormValues>(
    () => ({
      entityId: initialEntityId,
      requisiteId: initialRequisiteId,
      reasonCode: "typo_correction",
    }),
    [initialEntityId, initialRequisiteId],
  );

  const {
    control,
    formState: { isDirty, isSubmitting },
    handleSubmit,
    reset,
    setValue,
  } = useForm<LegEditorFormValues>({
    resolver: zodResolver(LegEditorFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, leg.idx, reset]);

  const entityId = useWatch({ control, name: "entityId" });
  const requisiteId = useWatch({ control, name: "requisiteId" });

  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [requisiteOptions, setRequisiteOptions] = useState<RequisiteOption[]>(
    [],
  );
  const [requisiteIssue, setRequisiteIssue] = useState<string | null>(null);

  useEffect(() => {
    if (!destEditableKind) {
      setEntityOptions([]);
      return;
    }
    let cancelled = false;
    const fetcher =
      destEditableKind === "organization"
        ? listCandidateOrganizations()
        : listCandidateCounterparties();
    fetcher.then((result) => {
      if (!cancelled) setEntityOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, [destEditableKind]);

  useEffect(() => {
    if (!entityId || !destEditableKind) {
      setRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisitesForOwner({
      ownerType: destEditableKind,
      ownerId: entityId,
      currencyId: targetCurrencyId,
    }).then((result) => {
      if (cancelled) return;
      setRequisiteOptions(result);
      if (!requisiteId) return;
      if (result.some((opt) => opt.id === requisiteId)) {
        setRequisiteIssue(null);
        return;
      }
      setRequisiteIssue(
        "Текущий реквизит не подходит по валюте — выберите новый",
      );
      setValue("requisiteId", null, { shouldDirty: true });
    });
    return () => {
      cancelled = true;
    };
  }, [destEditableKind, entityId, requisiteId, setValue, targetCurrencyId]);

  async function onSubmit(values: LegEditorFormValues) {
    const changes: {
      executionCounterpartyId?: string | null;
      requisiteId?: string | null;
    } = {};
    if (values.entityId !== initialEntityId) {
      changes.executionCounterpartyId = values.entityId;
    }
    if (values.requisiteId !== initialRequisiteId) {
      changes.requisiteId = values.requisiteId;
    }

    if (Object.keys(changes).length === 0) return;

    const result = await executeMutation({
      fallbackMessage: "Не удалось применить правку",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/legs/${leg.idx}/amend`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              amendmentKind: "execution",
              changes,
              reasonCode: values.reasonCode,
            }),
          },
        ),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Правка применена");
    onAmended();
  }

  const selectedEntityLabel =
    entityOptions.find((opt) => opt.id === entityId)?.label ??
    (entityId && entityId === destParticipant?.entityId
      ? destParticipant.displayName
      : null);

  const selectedRequisiteLabel =
    requisiteOptions.find((opt) => opt.id === requisiteId)?.label ??
    (requisiteId && requisiteId === destParticipant?.requisiteId
      ? "Текущий реквизит"
      : null);

  if (!hasRouteBinding) return null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="border-muted bg-muted/20 space-y-3 rounded-md border px-4 py-3"
      data-testid={`finance-deal-leg-participant-editor-${leg.idx}`}
    >

      {/* 3-column grid. Row 1 carries source / arrow / destination; row 2
          keeps the requisite in the destination column only, so it's
          visually obvious which participant it belongs to. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-3 gap-y-3">
        <DisabledParticipantSelect
          legIdx={leg.idx}
          side="source"
          participant={sourceParticipant}
        />

        <ArrowRight className="text-muted-foreground mb-2 h-4 w-4 shrink-0 self-end" />

        {canEditDestEntity ? (
          <Controller
            name="entityId"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor={`leg-${leg.idx}-entity`}>
                  {destEditableKind === "organization"
                    ? "Внутренний контрагент"
                    : "Контрагент шага"}
                </Label>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => field.onChange(value || null)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id={`leg-${leg.idx}-entity`}
                    data-testid={`finance-deal-leg-participant-entity-${leg.idx}`}
                    className="w-full"
                  >
                    <SelectValue placeholder="Выберите контрагента">
                      {selectedEntityLabel ?? undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        ) : (
          <DisabledParticipantSelect
            legIdx={leg.idx}
            side="destination"
            participant={destParticipant}
          />
        )}

        {canEditDestRequisite ? (
          <Controller
            name="requisiteId"
            control={control}
            render={({ field }) => (
              <div className="col-start-3 space-y-2">
                <Label htmlFor={`leg-${leg.idx}-requisite`}>Реквизит</Label>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => field.onChange(value || null)}
                  disabled={isSubmitting || !entityId}
                >
                  <SelectTrigger
                    id={`leg-${leg.idx}-requisite`}
                    data-testid={`finance-deal-leg-participant-requisite-${leg.idx}`}
                    className="w-full"
                  >
                    <SelectValue
                      placeholder={
                        entityId
                          ? requisiteOptions.length === 0
                            ? "Нет подходящих реквизитов"
                            : "Выберите реквизит"
                          : "Сначала выберите контрагента"
                      }
                    >
                      {selectedRequisiteLabel ?? undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {requisiteOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {requisiteIssue ? (
                  <p className="text-amber-600 text-xs">{requisiteIssue}</p>
                ) : null}
              </div>
            )}
          />
        ) : null}
      </div>

      {isDirty ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          data-testid={`finance-deal-leg-participant-apply-${leg.idx}`}
        >
          <Controller
            name="reasonCode"
            control={control}
            render={({ field }) => (
              <div className="min-w-[200px]">
                <Label htmlFor={`leg-${leg.idx}-reason`} className="sr-only">
                  Причина правки
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value)
                      field.onChange(value as ExecutionAmendmentReason);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id={`leg-${leg.idx}-reason`}
                    data-testid={`finance-deal-leg-participant-reason-${leg.idx}`}
                  >
                    <SelectValue>{REASON_LABELS[field.value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Button size="sm" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Применяем..." : "Применить правку"}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => reset(defaultValues)}
            disabled={isSubmitting}
          >
            Сбросить
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function roleLabel(
  participant: FinanceDealRouteAttachmentParticipant | null,
): string {
  if (!participant) return "—";
  if (participant.role === "source") return "Отправитель";
  if (participant.role === "destination") return "Получатель";
  return "Промежуточный узел";
}

function DisabledParticipantSelect({
  legIdx,
  participant,
  side,
}: {
  legIdx: number;
  participant: FinanceDealRouteAttachmentParticipant | null;
  side: "source" | "destination";
}) {
  const fieldId = `leg-${legIdx}-${side}`;
  const entityId = participant?.entityId ?? null;
  const displayName = participant?.displayName ?? null;
  const hasOption = Boolean(entityId);
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{roleLabel(participant)}</Label>
      <Select value={entityId ?? ""} disabled>
        <SelectTrigger
          id={fieldId}
          data-testid={`finance-deal-leg-participant-${side}-${legIdx}`}
          className="w-full"
        >
          <SelectValue placeholder="Не назначен">
            {displayName ?? undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {hasOption && entityId ? (
            <SelectItem value={entityId}>{displayName ?? entityId}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
