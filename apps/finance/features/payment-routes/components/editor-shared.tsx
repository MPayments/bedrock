"use client";

import * as React from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type { PaymentRouteFee } from "@bedrock/treasury/contracts";

import {
  changeFeeKind,
  getParticipantKindOptions,
  type PaymentRouteEditorState,
  type PaymentRouteSelectableParticipantOption,
} from "../lib/state";
import { formatCurrencyMinorAmount, parseMajorToMinorAmount } from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";

const LEG_KIND_LABELS: Record<
  PaymentRouteEditorState["draft"]["legs"][number]["kind"],
  string
> = {
  collect: "Сбор",
  cross_company: "Cross-company",
  exchange: "Обмен",
  intercompany: "Intercompany",
  payout: "Выплата",
  transfer: "Перевод",
};

type BufferedMinorAmountInputProps = {
  ariaLabel: string;
  className?: string;
  currencyId: string;
  onCommit: (nextMinor: string) => void;
  options: PaymentRouteConstructorOptions;
  valueMinor: string;
};

type BufferedDecimalInputProps = {
  ariaLabel: string;
  className?: string;
  onCommit: (nextValue: string) => void;
  value: string;
};

type ParticipantSelectorProps = {
  index: number;
  onEntityChange: (entityId: string) => void;
  onKindChange: (kind: PaymentRouteSelectableParticipantOption["kind"]) => void;
  options: PaymentRouteConstructorOptions;
  participant: PaymentRouteEditorState["draft"]["participants"][number];
  state: PaymentRouteEditorState;
};

type CurrencySelectorProps = {
  ariaLabel: string;
  onChange: (currencyId: string) => void;
  options: PaymentRouteConstructorOptions;
  value: string;
};

type FeeListEditorProps = {
  addLabel?: string;
  fallbackCurrencyId: string;
  fees: PaymentRouteFee[];
  onAdd: () => void;
  onChange: (feeId: string, updater: (fee: PaymentRouteFee) => PaymentRouteFee) => void;
  onRemove: (feeId: string) => void;
  options: PaymentRouteConstructorOptions;
};

export function getLegKindLabel(
  kind: string,
) {
  return LEG_KIND_LABELS[
    kind as PaymentRouteEditorState["draft"]["legs"][number]["kind"]
  ] ?? kind;
}

export function BufferedMinorAmountInput({
  ariaLabel,
  className,
  currencyId,
  onCommit,
  options,
  valueMinor,
}: BufferedMinorAmountInputProps) {
  const currency =
    options.currencies.find((candidate) => candidate.id === currencyId) ?? null;
  const [value, setValue] = React.useState(
    currency ? formatCurrencyMinorAmount(valueMinor, currency).replace(` ${currency.code}`, "") : valueMinor,
  );

  React.useEffect(() => {
    setValue(
      currency
        ? formatCurrencyMinorAmount(valueMinor, currency).replace(` ${currency.code}`, "")
        : valueMinor,
    );
  }, [currency, valueMinor]);

  function commit(nextValue: string) {
    const parsed = parseMajorToMinorAmount({
      currency,
      value: nextValue,
    });

    if (!parsed) {
      setValue(
        currency
          ? formatCurrencyMinorAmount(valueMinor, currency).replace(` ${currency.code}`, "")
          : valueMinor,
      );
      return;
    }

    onCommit(parsed);
    setValue(nextValue);
  }

  return (
    <Input
      aria-label={ariaLabel}
      inputMode="decimal"
      className={className}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget.value);
        }
      }}
    />
  );
}

export function BufferedDecimalInput({
  ariaLabel,
  className,
  onCommit,
  value,
}: BufferedDecimalInputProps) {
  const [draftValue, setDraftValue] = React.useState(value);

  React.useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function commit(nextValue: string) {
    const normalized = nextValue.trim().replace(",", ".");

    if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
      setDraftValue(value);
      return;
    }

    onCommit(normalized);
    setDraftValue(normalized);
  }

  return (
    <Input
      aria-label={ariaLabel}
      inputMode="decimal"
      className={className}
      value={draftValue}
      onChange={(event) => setDraftValue(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget.value);
        }
      }}
    />
  );
}

export function CurrencySelector({
  ariaLabel,
  onChange,
  options,
  value,
}: CurrencySelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder="Выберите валюту" />
      </SelectTrigger>
      <SelectContent>
        {options.currencies.map((currency) => (
          <SelectItem key={currency.id} value={currency.id}>
            {currency.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ParticipantSelector({
  index,
  onEntityChange,
  onKindChange,
  options,
  participant,
  state,
}: ParticipantSelectorProps) {
  const kindOptions = getParticipantKindOptions(index, state.draft);
  const selectableOptions =
    participant.kind === "customer"
      ? options.customers
      : participant.kind === "organization"
        ? options.organizations
        : options.counterparties;

  return (
    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <Select
        value={participant.kind}
        onValueChange={(value) => {
          if (value) {
            onKindChange(value as PaymentRouteSelectableParticipantOption["kind"]);
          }
        }}
      >
        <SelectTrigger aria-label="Тип участника">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {kindOptions.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {kind === "customer"
                ? "Клиент"
                : kind === "organization"
                  ? "Организация"
                  : "Контрагент"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={participant.entityId}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onEntityChange(nextValue);
          }
        }}
      >
        <SelectTrigger aria-label="Участник маршрута">
          <SelectValue placeholder="Выберите участника" />
        </SelectTrigger>
        <SelectContent>
          {selectableOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {"name" in option ? option.name : option.shortName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FeeListEditor({
  addLabel = "Добавить комиссию",
  fallbackCurrencyId,
  fees,
  onAdd,
  onChange,
  onRemove,
  options,
}: FeeListEditorProps) {
  return (
    <div className="space-y-3">
      {fees.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          Комиссии не добавлены.
        </div>
      ) : (
        fees.map((fee) => {
          const currencyId =
            fee.kind === "fixed" ? fee.currencyId ?? fallbackCurrencyId : fallbackCurrencyId;

          return (
            <div
              key={fee.id}
              className="rounded-lg border border-border/70 bg-background/70 p-3"
            >
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
                <Input
                  aria-label="Название комиссии"
                  placeholder="Название комиссии"
                  value={fee.label ?? ""}
                  onChange={(event) =>
                    onChange(fee.id, (current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
                <Select
                  value={fee.kind}
                  onValueChange={(nextKind) => {
                    if (!nextKind) {
                      return;
                    }

                    onChange(fee.id, (current) =>
                      changeFeeKind({
                        fallbackCurrencyId,
                        fee: current,
                        nextKind: nextKind as PaymentRouteFee["kind"],
                      }),
                    );
                  }}
                >
                  <SelectTrigger aria-label="Тип комиссии">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Фикс</SelectItem>
                    <SelectItem value="percent">Процент</SelectItem>
                  </SelectContent>
                </Select>
                {fee.kind === "fixed" ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <BufferedMinorAmountInput
                      ariaLabel="Сумма комиссии"
                      currencyId={currencyId}
                      options={options}
                      valueMinor={fee.amountMinor ?? "100"}
                      onCommit={(amountMinor) =>
                        onChange(fee.id, (current) => ({
                          ...current,
                          amountMinor,
                          currencyId,
                        }))
                      }
                    />
                    <CurrencySelector
                      ariaLabel="Валюта комиссии"
                      options={options}
                      value={currencyId}
                      onChange={(nextCurrencyId) =>
                        onChange(fee.id, (current) => ({
                          ...current,
                          currencyId: nextCurrencyId,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <BufferedDecimalInput
                      ariaLabel="Процент комиссии"
                      value={fee.percentage ?? "0.10"}
                      onCommit={(percentage) =>
                        onChange(fee.id, (current) => ({
                          id: current.id,
                          kind: "percent",
                          label: current.label,
                          percentage,
                        }))
                      }
                    />
                    <Badge variant="outline">%</Badge>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRemove(fee.id)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          );
        })
      )}
      <Button type="button" variant="outline" onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}

export function CalculationHint({
  className,
  text,
}: {
  className?: string;
  text: string | null;
}) {
  if (!text) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-900",
        className,
      )}
    >
      {text}
    </div>
  );
}
