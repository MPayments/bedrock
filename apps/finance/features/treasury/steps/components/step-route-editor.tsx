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

import type {
  FinanceDealBankInstructionSnapshot,
  FinanceDealPaymentStep,
} from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import {
  listCurrencyOptions,
  type CurrencyOption,
} from "../lib/currency-options";
import {
  buildAmendRouteBody,
  type AmendFieldValues,
} from "../lib/step-helpers";
import {
  listPartyOptions,
  listRequisiteOptions,
  resolvePartyOption,
  type PartyKind,
  type PartyKindOrSnapshot,
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

function normalizeMajorToMinor(
  raw: string,
  currencyCode: string | null,
): string | null {
  if (!currencyCode) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
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
  if (!minor || !currencyCode) return "";
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
  fromPartyKind?: PartyKindOrSnapshot | null;
  toPartyKind?: PartyKindOrSnapshot | null;
  fromPartyDisplayName?: string | null;
  toPartyDisplayName?: string | null;
  fromBankInstruction?: FinanceDealBankInstructionSnapshot | null;
  toBankInstruction?: FinanceDealBankInstructionSnapshot | null;
  debounceMs?: number;
  onAmended?: () => void;
  disabled?: boolean;
}

export function StepRouteEditor({
  debounceMs = 500,
  disabled,
  fromBankInstruction = null,
  fromPartyDisplayName = null,
  fromPartyKind = null,
  onAmended,
  step,
  toBankInstruction = null,
  toPartyDisplayName = null,
  toPartyKind = null,
}: StepRouteEditorProps) {
  const isEditable = MUTABLE_STATES.has(step.state) && !disabled;

  // Currency codes are resolved from the step's own currency IDs through
  // the global catalog. Avoids leaking implementation details (no "minor"
  // placeholder) and keeps the editor decoupled from how the parent fetched
  // the deal's route attachment.
  const [currencyCatalog, setCurrencyCatalog] = useState<CurrencyOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    listCurrencyOptions().then((options) => {
      if (!cancelled) setCurrencyCatalog(options);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const currencyCodeById = useMemo(
    () => new Map(currencyCatalog.map((opt) => [opt.id, opt.code] as const)),
    [currencyCatalog],
  );
  const fromCurrencyCode = currencyCodeById.get(step.fromCurrencyId) ?? null;
  const toCurrencyCode = currencyCodeById.get(step.toCurrencyId) ?? null;

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
        {fromPartyKind === "beneficiary_snapshot" ? (
          <SnapshotBeneficiarySide
            side="from"
            displayName={fromPartyDisplayName}
            bankInstruction={fromBankInstruction}
          />
        ) : (
          <PartySideEditor
            side="from"
            stepId={step.id}
            kind={fromPartyKind ?? null}
            displayName={fromPartyDisplayName}
            editable={isEditable}
            partyId={values.fromPartyId}
            requisiteId={values.fromRequisiteId}
            currencyId={values.fromCurrencyId}
            currencyCode={fromCurrencyCode}
            // FX conversion steps use settlement accounts that may not match
            // the leg's nominal currency (provider-side multi-currency
            // routing). Skip the strict currency-match warning for them.
            enforceCurrencyMatch={step.kind !== "fx_conversion"}
            onChangePartyId={(nextPartyId) =>
              applyChange({
                ...values,
                fromPartyId: nextPartyId,
                fromRequisiteId: null,
              })
            }
            onChangeRequisiteId={(nextRequisiteId) =>
              updateField("fromRequisiteId", nextRequisiteId)
            }
          />
        )}

        <ArrowRight className="text-muted-foreground mb-2 h-4 w-4 shrink-0 self-end" />

        {toPartyKind === "beneficiary_snapshot" ? (
          <SnapshotBeneficiarySide
            side="to"
            displayName={toPartyDisplayName}
            bankInstruction={toBankInstruction}
          />
        ) : (
          <PartySideEditor
            side="to"
            stepId={step.id}
            kind={toPartyKind ?? null}
            displayName={toPartyDisplayName}
            editable={isEditable}
            partyId={values.toPartyId}
            requisiteId={values.toRequisiteId}
            currencyId={values.toCurrencyId}
            currencyCode={toCurrencyCode}
            enforceCurrencyMatch={step.kind !== "fx_conversion"}
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
        )}
      </div>

      {step.kind === "fx_conversion" ? (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <AmountInput
              currencyCode={fromCurrencyCode}
              disabled={!isEditable}
              display={fromAmountDisplay}
              label="Сумма отправителя"
              onChange={(nextDisplay) => {
                setFromAmountDisplay(nextDisplay);
                const minor = normalizeMajorToMinor(
                  nextDisplay,
                  fromCurrencyCode,
                );
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
                const minor = normalizeMajorToMinor(
                  nextDisplay,
                  toCurrencyCode,
                );
                if (minor !== null) {
                  applyChange({ ...values, toAmountMinor: minor });
                }
              }}
              testId={`finance-step-to-amount-${step.id}`}
              inputId={`step-${step.id}-to-amount`}
            />
          </div>
          {step.rate ? (
            <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
              <span>Курс</span>
              <span
                className="font-mono text-sm font-medium text-foreground"
                data-testid={`finance-step-rate-${step.id}`}
              >
                1 {fromCurrencyCode ?? "?"} = {step.rate.value}{" "}
                {toCurrencyCode ?? "?"}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        // Non-FX legs (collect / payout / transit_hold / internal_transfer):
        // single amount and currency. The receiver shows the same amount —
        // there's no conversion happening.
        <div className="grid grid-cols-1 gap-x-3 gap-y-3">
          <AmountInput
            currencyCode={fromCurrencyCode}
            disabled={!isEditable}
            display={fromAmountDisplay}
            label="Сумма"
            onChange={(nextDisplay) => {
              setFromAmountDisplay(nextDisplay);
              setToAmountDisplay(nextDisplay);
              const minor = normalizeMajorToMinor(
                nextDisplay,
                fromCurrencyCode,
              );
              if (minor !== null) {
                applyChange({
                  ...values,
                  fromAmountMinor: minor,
                  toAmountMinor: minor,
                });
              }
            }}
            testId={`finance-step-from-amount-${step.id}`}
            inputId={`step-${step.id}-from-amount`}
          />
        </div>
      )}

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
  currencyId: string;
  currencyCode: string | null;
  enforceCurrencyMatch: boolean;
  onChangePartyId: (partyId: string) => void;
  onChangeRequisiteId: (requisiteId: string | null) => void;
}

function PartySideEditor({
  currencyCode,
  currencyId,
  displayName,
  editable,
  enforceCurrencyMatch,
  kind: kindProp,
  onChangePartyId,
  onChangeRequisiteId,
  partyId,
  requisiteId,
  side,
  stepId,
}: PartySideEditorProps) {
  const [partyOptions, setPartyOptions] = useState<PartyOption[]>([]);
  const [allRequisiteOptions, setAllRequisiteOptions] = useState<
    RequisiteOption[]
  >([]);
  const [resolved, setResolved] = useState<{
    kind: PartyKind;
    label: string;
  } | null>(null);
  useEffect(() => {
    if (!partyId) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    resolvePartyOption(partyId).then((entry) => {
      if (!cancelled) setResolved(entry);
    });
    return () => {
      cancelled = true;
    };
  }, [partyId]);
  const effectiveDisplayName = displayName ?? resolved?.label ?? null;
  // Route attachments may bind participants abstractly (no entityKind), so
  // workbench can't always supply `kind`. Recover it by probing the party
  // through the options endpoints — that gives us the right Select to
  // render and the right requisite endpoint to query.
  const kind: PartyKind | null = kindProp ?? resolved?.kind ?? null;

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
    if (!kind || !partyId) {
      setAllRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisiteOptions({ ownerType: kind, ownerId: partyId }).then(
      (options) => {
        if (!cancelled) setAllRequisiteOptions(options);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [kind, partyId]);

  // Filter to currency-compatible requisites for non-FX legs (where the
  // leg's currency is unambiguously the requisite's currency). FX legs
  // skip this filter — settlement accounts at FX providers don't always
  // line up with the nominal "from"/"to" currency of the leg.
  const compatibleRequisiteOptions = enforceCurrencyMatch
    ? allRequisiteOptions.filter((opt) => opt.currencyId === currencyId)
    : allRequisiteOptions;
  const requisiteOptions =
    requisiteId &&
    !compatibleRequisiteOptions.some((opt) => opt.id === requisiteId)
      ? [
          ...compatibleRequisiteOptions,
          ...allRequisiteOptions.filter((opt) => opt.id === requisiteId),
        ]
      : compatibleRequisiteOptions;

  const noRequisitesAtAll = allRequisiteOptions.length === 0;
  const noCompatibleRequisites =
    !noRequisitesAtAll && compatibleRequisiteOptions.length === 0;

  if (!kind) {
    return (
      <div className="space-y-2">
        <Label>{SIDE_LABELS[side]}</Label>
        <div className="text-sm font-medium">
          {effectiveDisplayName ?? "Не определено"}
        </div>
        <div className="text-muted-foreground text-xs">
          {requisiteId ? "Реквизит привязан" : "Реквизит не задан"}
        </div>
      </div>
    );
  }

  const selectedPartyLabel =
    partyOptions.find((opt) => opt.id === partyId)?.label ??
    effectiveDisplayName ??
    "Выберите контрагента";
  const selectedRequisite =
    allRequisiteOptions.find((opt) => opt.id === requisiteId) ?? null;
  const selectedRequisiteUnknown =
    requisiteId !== null && selectedRequisite === null;
  // Never expose raw UUID: if the bound requisite isn't in the fetched owner's
  // option list, show a clear "unknown binding" message instead of a hex blob.
  const selectedRequisiteLabel = selectedRequisite?.label ?? undefined;
  const placeholder = selectedRequisiteUnknown
    ? "Привязанный реквизит не найден у владельца"
    : noRequisitesAtAll
      ? `Нет реквизитов у ${PARTY_KIND_LABELS[kind].toLowerCase()}а`
      : noCompatibleRequisites
        ? `Нет реквизитов в ${currencyCode ?? "нужной валюте"}`
        : "Выберите реквизит";

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
        onValueChange={(value) => onChangeRequisiteId(value ? value : null)}
        disabled={!editable || requisiteOptions.length === 0}
      >
        <SelectTrigger
          id={`step-${stepId}-${side}-requisite`}
          data-testid={`finance-step-${side}-requisite-${stepId}`}
          className="w-full"
        >
          <SelectValue placeholder={placeholder}>
            {selectedRequisiteLabel ?? undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {requisiteOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
              {enforceCurrencyMatch &&
              opt.currencyId !== currencyId &&
              currencyCode ? (
                <span className="text-destructive ml-1 text-xs">
                  (другая валюта)
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {enforceCurrencyMatch &&
      selectedRequisite &&
      selectedRequisite.currencyId !== currencyId ? (
        <div className="text-destructive text-xs">
          Реквизит не совпадает с валютой шага ({currencyCode ?? "?"}).
        </div>
      ) : null}
    </div>
  );
}

interface SnapshotBeneficiarySideProps {
  side: SideKey;
  displayName: string | null;
  bankInstruction: FinanceDealBankInstructionSnapshot | null;
}

function SnapshotBeneficiarySide({
  bankInstruction,
  displayName,
  side,
}: SnapshotBeneficiarySideProps) {
  const rows: Array<{ label: string; value: string }> = [];
  if (bankInstruction?.bankName) {
    rows.push({ label: "Банк", value: bankInstruction.bankName });
  }
  if (bankInstruction?.accountNo) {
    rows.push({ label: "Счёт", value: bankInstruction.accountNo });
  }
  if (bankInstruction?.iban) {
    rows.push({ label: "IBAN", value: bankInstruction.iban });
  }
  if (bankInstruction?.bic) {
    rows.push({ label: "BIC", value: bankInstruction.bic });
  }
  if (bankInstruction?.swift) {
    rows.push({ label: "SWIFT", value: bankInstruction.swift });
  }
  return (
    <div className="space-y-2">
      <Label>
        {SIDE_LABELS[side]}
        <span className="text-muted-foreground ml-2 text-xs">· Бенефициар</span>
      </Label>
      <div className="text-sm font-medium">{displayName ?? "—"}</div>
      {rows.length > 0 ? (
        <dl className="text-muted-foreground space-y-0.5 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-2">
              <dt className="shrink-0">{row.label}:</dt>
              <dd className="text-foreground break-all font-mono">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="text-muted-foreground text-xs">
          Банковские реквизиты не указаны
        </div>
      )}
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
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {currencyCode ? (
          <span className="text-muted-foreground ml-2 text-xs">
            · {currencyCode}
          </span>
        ) : null}
      </Label>
      <Input
        id={inputId}
        inputMode="decimal"
        placeholder="0,00"
        disabled={disabled || !currencyCode}
        value={display}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </div>
  );
}
