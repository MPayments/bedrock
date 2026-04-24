"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, TriangleAlert } from "lucide-react";

import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import {
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import {
  buildAmendRouteBody,
  type AmendFieldValues,
} from "../lib/step-helpers";
import {
  listCurrencyOptions,
  type CurrencyOption,
} from "../lib/currency-options";
import {
  listPartyOptions,
  listRequisiteOptions,
  type PartyKind,
  type PartyOption,
  type RequisiteOption,
} from "../lib/party-options";
import { useDebouncedCallback } from "../lib/use-debounced-callback";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Convert a user-typed major amount into the backend's minor-units string
 * representation. Accepts both `.` and `,` as decimal separators, trims
 * leading zeros, and rejects empty / zero inputs (the amend schema requires
 * positive amounts). When no currency code is supplied the editor stays in
 * the legacy minor-mode for backwards compat — the input is expected to
 * already be an integer string of minor units.
 */
function normalizeMajorToMinor(
  raw: string,
  currencyCode: string | null,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!currencyCode) {
    if (!/^\d+$/.test(trimmed)) return null;
    if (trimmed === "0") return null;
    return trimmed.replace(/^0+/, "") || "0";
  }
  try {
    const minor = toMinorAmountString(trimmed, currencyCode, {
      requirePositive: true,
    });
    return minor.replace(/^0+/, "") || "0";
  } catch {
    return null;
  }
}

function formatMinorForInput(
  minor: string | null,
  currencyCode: string | null,
): string {
  if (!minor) return "";
  if (!currencyCode) return minor;
  return minorToAmountString(minor, { currency: currencyCode });
}

const MUTABLE_STATES: ReadonlySet<FinanceDealPaymentStep["state"]> = new Set([
  "draft",
  "scheduled",
  "pending",
]);

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SideKey = "from" | "to";

const SIDE_LABELS: Record<SideKey, string> = {
  from: "Отправитель",
  to: "Получатель",
};

const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  counterparty: "Контрагент",
  customer: "Клиент",
  organization: "Организация",
};

export interface StepRouteEditorProps {
  step: FinanceDealPaymentStep;
  /**
   * Kind of the source party, as known by the parent (usually derived from
   * the deal's `routeAttachment.participants`). When set, the editor renders
   * an inline Select for both the party and its requisite. When null or
   * undefined (e.g. for standalone steps), the side stays read-only.
   */
  fromPartyKind?: PartyKind | null;
  toPartyKind?: PartyKind | null;
  /**
   * Human-readable display names — e.g. `"ARABIAN FUEL ALLIANCE DMCC"` —
   * resolved upstream from the deal's route-attachment participants. Used
   * both for the read-only fallback (no party kind) and to seed the initial
   * label on the editable Select so the user never sees a raw UUID.
   */
  fromPartyDisplayName?: string | null;
  toPartyDisplayName?: string | null;
  /**
   * ISO-4217 codes for the amount inputs. The editor shows / edits the
   * major-unit amount ("125.00 USD") and converts to/from minor on save
   * using `Intl` precision. Omit to fall back to the raw minor input.
   */
  fromCurrencyCode?: string | null;
  toCurrencyCode?: string | null;
  debounceMs?: number;
  onAmended?: () => void;
  disabled?: boolean;
}

export function StepRouteEditor({
  debounceMs = 500,
  disabled,
  fromCurrencyCode = null,
  fromPartyDisplayName = null,
  fromPartyKind = null,
  onAmended,
  step,
  toCurrencyCode = null,
  toPartyDisplayName = null,
  toPartyKind = null,
}: StepRouteEditorProps) {
  const isEditable = MUTABLE_STATES.has(step.state) && !disabled;

  const initialValues = useMemo<AmendFieldValues>(
    () => ({
      fromAmountMinor: step.fromAmountMinor,
      fromCurrencyId: step.fromCurrencyId,
      fromPartyId: step.fromParty.id,
      fromRequisiteId: step.fromParty.requisiteId,
      rate: step.rate,
      toAmountMinor: step.toAmountMinor,
      toCurrencyId: step.toCurrencyId,
      toPartyId: step.toParty.id,
      toRequisiteId: step.toParty.requisiteId,
    }),
    [step],
  );

  const [values, setValues] = useState<AmendFieldValues>(initialValues);
  // The input shows the major-unit amount to humans ("125,00"), while the
  // source of truth (`values.fromAmountMinor`) stays in minor units. We
  // track the editing text separately so intermediate states like "125," or
  // "125.0" don't get squashed by the minor→major round-trip.
  const [fromAmountDisplay, setFromAmountDisplay] = useState(() =>
    formatMinorForInput(initialValues.fromAmountMinor, fromCurrencyCode),
  );
  const [toAmountDisplay, setToAmountDisplay] = useState(() =>
    formatMinorForInput(initialValues.toAmountMinor, toCurrencyCode),
  );
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setValues(initialValues);
    setFromAmountDisplay(
      formatMinorForInput(initialValues.fromAmountMinor, fromCurrencyCode),
    );
    setToAmountDisplay(
      formatMinorForInput(initialValues.toAmountMinor, toCurrencyCode),
    );
    setStatus("idle");
  }, [initialValues, fromCurrencyCode, toCurrencyCode]);

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

  function applyChange(next: AmendFieldValues) {
    setValues(next);
    debouncedSave(next);
  }

  function updateField<K extends keyof AmendFieldValues>(
    key: K,
    value: AmendFieldValues[K],
  ) {
    applyChange({ ...values, [key]: value });
  }

  return (
    <div
      className="border-muted bg-muted/20 space-y-3 rounded-md border px-4 py-3"
      data-testid={`finance-step-route-editor-${step.id}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3">
        <PartySideEditor
          side="from"
          stepId={step.id}
          kind={fromPartyKind}
          displayName={fromPartyDisplayName}
          editable={isEditable}
          partyId={values.fromPartyId}
          requisiteId={values.fromRequisiteId}
          onChangePartyId={(nextPartyId) =>
            applyChange({
              ...values,
              fromPartyId: nextPartyId,
              // Requisite must be revalidated against the new owner — reset
              // it locally; the treasurer picks a new one in the Select below.
              fromRequisiteId: null,
            })
          }
          onChangeRequisiteId={(nextRequisiteId) =>
            updateField("fromRequisiteId", nextRequisiteId)
          }
        />

        <ArrowRight className="text-muted-foreground mb-2 h-4 w-4 shrink-0 self-end" />

        <PartySideEditor
          side="to"
          stepId={step.id}
          kind={toPartyKind}
          displayName={toPartyDisplayName}
          editable={isEditable}
          partyId={values.toPartyId}
          requisiteId={values.toRequisiteId}
          onChangePartyId={(nextPartyId) =>
            applyChange({
              ...values,
              toPartyId: nextPartyId,
              toRequisiteId: null,
            })
          }
          onChangeRequisiteId={(nextRequisiteId) =>
            updateField("toRequisiteId", nextRequisiteId)
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <AmountInput
          currencyCode={fromCurrencyCode}
          disabled={!isEditable}
          display={fromAmountDisplay}
          label="Сумма отправителя"
          onChange={(nextDisplay) => {
            setFromAmountDisplay(nextDisplay);
            const minor = normalizeMajorToMinor(nextDisplay, fromCurrencyCode);
            // Only push to the debounced save when the input parses; the
            // user can keep typing through intermediate invalid states
            // (e.g. "125," or "12.34.") without each keystroke sending a
            // request.
            if (minor !== null) {
              applyChange({ ...values, fromAmountMinor: minor });
            }
          }}
          testId={`finance-step-from-amount-${step.id}`}
          inputId={`step-${step.id}-from-amount`}
        />
        <AmountInput
          currencyCode={toCurrencyCode}
          disabled={!isEditable}
          display={toAmountDisplay}
          label="Сумма получателя"
          onChange={(nextDisplay) => {
            setToAmountDisplay(nextDisplay);
            const minor = normalizeMajorToMinor(nextDisplay, toCurrencyCode);
            if (minor !== null) {
              applyChange({ ...values, toAmountMinor: minor });
            }
          }}
          testId={`finance-step-to-amount-${step.id}`}
          inputId={`step-${step.id}-to-amount`}
        />
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

interface PartySideEditorProps {
  side: SideKey;
  stepId: string;
  kind: PartyKind | null;
  displayName: string | null;
  editable: boolean;
  partyId: string;
  requisiteId: string | null;
  onChangePartyId: (partyId: string) => void;
  onChangeRequisiteId: (requisiteId: string | null) => void;
}

function PartySideEditor({
  displayName,
  editable,
  kind,
  onChangePartyId,
  onChangeRequisiteId,
  partyId,
  requisiteId,
  side,
  stepId,
}: PartySideEditorProps) {
  const [partyOptions, setPartyOptions] = useState<PartyOption[]>([]);
  const [requisiteOptions, setRequisiteOptions] = useState<RequisiteOption[]>(
    [],
  );

  useEffect(() => {
    if (!kind || !editable) {
      setPartyOptions([]);
      return;
    }
    let cancelled = false;
    listPartyOptions(kind).then((options) => {
      if (!cancelled) setPartyOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [editable, kind]);

  useEffect(() => {
    if (!kind || !editable || !partyId) {
      setRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisiteOptions({ ownerType: kind, ownerId: partyId }).then(
      (options) => {
        if (!cancelled) setRequisiteOptions(options);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [editable, kind, partyId]);

  if (!kind) {
    return (
      <div className="space-y-2">
        <Label>{SIDE_LABELS[side]}</Label>
        <div className="text-sm font-medium">
          {displayName ?? "Не назначен"}
        </div>
        <div className="text-muted-foreground text-xs">
          {requisiteId ? "Реквизит привязан" : "Реквизит не задан"}
        </div>
      </div>
    );
  }

  const selectedPartyLabel =
    partyOptions.find((opt) => opt.id === partyId)?.label ??
    displayName ??
    partyId;
  const selectedRequisiteLabel =
    requisiteOptions.find((opt) => opt.id === requisiteId)?.label ??
    (requisiteId ?? undefined);

  return (
    <div className="space-y-2">
      <Label htmlFor={`step-${stepId}-${side}-party`}>
        {SIDE_LABELS[side]}
        <span className="text-muted-foreground ml-2 text-xs">
          · {PARTY_KIND_LABELS[kind]}
        </span>
      </Label>
      <Select
        value={partyId}
        onValueChange={(value) => {
          if (value) onChangePartyId(value);
        }}
        disabled={!editable}
      >
        <SelectTrigger
          id={`step-${stepId}-${side}-party`}
          data-testid={`finance-step-${side}-party-${stepId}`}
          className="w-full"
        >
          <SelectValue placeholder="Выберите контрагента">
            {selectedPartyLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {partyOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={requisiteId ?? ""}
        onValueChange={(value) =>
          onChangeRequisiteId(value ? value : null)
        }
        disabled={!editable || requisiteOptions.length === 0}
      >
        <SelectTrigger
          id={`step-${stepId}-${side}-requisite`}
          data-testid={`finance-step-${side}-requisite-${stepId}`}
          className="w-full"
        >
          <SelectValue
            placeholder={
              requisiteOptions.length === 0
                ? "Нет подходящих реквизитов"
                : "Выберите реквизит"
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
    </div>
  );
}

interface AmountInputProps {
  currencyCode: string | null;
  disabled: boolean;
  display: string;
  inputId: string;
  label: string;
  onChange: (next: string) => void;
  testId: string;
}

function AmountInput({
  currencyCode,
  disabled,
  display,
  inputId,
  label,
  onChange,
  testId,
}: AmountInputProps) {
  const placeholder = currencyCode ? "0,00" : "0";
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {currencyCode ? (
          <span className="text-muted-foreground ml-2 text-xs">
            · {currencyCode}
          </span>
        ) : (
          <span className="text-muted-foreground ml-2 text-xs">· minor</span>
        )}
      </Label>
      <Input
        id={inputId}
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        value={display}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </div>
  );
}
