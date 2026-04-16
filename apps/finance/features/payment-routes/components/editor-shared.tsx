"use client";

import * as React from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { ButtonGroup } from "@bedrock/sdk-ui/components/button-group";
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
  getSelectableParticipantOptions,
  type PaymentRouteEditorState,
  type PaymentRouteSelectableParticipantOption,
} from "../lib/state";
import {
  formatCurrencyMinorAmount,
  parseMajorToMinorAmount,
} from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";

const LEG_KIND_LABELS: Record<
  PaymentRouteEditorState["draft"]["legs"][number]["kind"],
  string
> = {
  collect: "Сбор",
  cross_company: "Межфирменный перевод",
  exchange: "Обмен",
  intercompany: "Внутригрупповой перевод",
  payout: "Выплата",
  transfer: "Перевод",
};

const FEE_KIND_LABELS: Record<PaymentRouteFee["kind"], string> = {
  fixed: "Фикс",
  percent: "Процент",
};

const PARTICIPANT_KIND_LABELS: Record<
  PaymentRouteSelectableParticipantOption["kind"],
  string
> = {
  counterparty: "Контрагент",
  customer: "Клиент",
  organization: "Организация",
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
  onBindingChange: (binding: "abstract" | "bound") => void;
  index: number;
  onEntityChange: (entityId: string) => void;
  onKindChange: (entityKind: PaymentRouteSelectableParticipantOption["kind"]) => void;
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
  onChange: (
    feeId: string,
    updater: (fee: PaymentRouteFee) => PaymentRouteFee,
  ) => void;
  onRemove: (feeId: string) => void;
  options: PaymentRouteConstructorOptions;
};

export function getLegKindLabel(kind: string) {
  return (
    LEG_KIND_LABELS[
      kind as PaymentRouteEditorState["draft"]["legs"][number]["kind"]
    ] ?? kind
  );
}

export function getFeeKindLabel(kind: PaymentRouteFee["kind"]) {
  return FEE_KIND_LABELS[kind] ?? kind;
}

export function getParticipantKindLabel(
  kind: PaymentRouteSelectableParticipantOption["kind"],
) {
  return PARTICIPANT_KIND_LABELS[kind] ?? kind;
}

function getSelectableOptionLabel(
  option: PaymentRouteSelectableParticipantOption | null,
) {
  if (!option) {
    return null;
  }

  return option.shortLabel;
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
    currency
      ? formatCurrencyMinorAmount(valueMinor, currency).replace(
          ` ${currency.code}`,
          "",
        )
      : valueMinor,
  );

  React.useEffect(() => {
    setValue(
      currency
        ? formatCurrencyMinorAmount(valueMinor, currency).replace(
            ` ${currency.code}`,
            "",
          )
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
          ? formatCurrencyMinorAmount(valueMinor, currency).replace(
              ` ${currency.code}`,
              "",
            )
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
  const selectedCurrency =
    options.currencies.find((currency) => currency.id === value) ?? null;

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
        <SelectValue placeholder="Выберите валюту">
          {selectedCurrency?.code ?? "Выберите валюту"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.currencies.map((currency) => (
          <SelectItem key={currency.id} value={currency.id}>
            {currency.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ParticipantSelector({
  index,
  onBindingChange,
  onEntityChange,
  onKindChange,
  options,
  participant,
  state,
}: ParticipantSelectorProps) {
  const kindOptions = getParticipantKindOptions(participant);
  const boundKind =
    participant.binding === "bound" ? participant.entityKind : kindOptions[0];
  const allSelectableOptions = getSelectableParticipantOptions({
    options,
    participant,
  });
  const selectableOptions = allSelectableOptions.filter(
    (option) => option.kind === boundKind,
  );
  const selectedOption =
    participant.binding === "bound"
      ? selectableOptions.find((option) => option.id === participant.entityId) ?? null
      : null;
  const selectedOptionLabel =
    getSelectableOptionLabel(selectedOption) ?? participant.displayName;
  const canBindConcrete = allSelectableOptions.length > 0;
  const showsBindingToggle = participant.role !== "hop";

  if (participant.binding === "abstract") {
    return (
      <div className="space-y-3">
        {showsBindingToggle ? (
          <ButtonGroup className="w-full">
            <Button
              type="button"
              variant="default"
              className="flex-1"
              onClick={() => onBindingChange("abstract")}
            >
              Любой
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!canBindConcrete}
              onClick={() => onBindingChange("bound")}
            >
              Конкретный
            </Button>
          </ButtonGroup>
        ) : null}
        <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {participant.displayName}
        </div>
      </div>
    );
  }

  const kindSelector =
    kindOptions.length > 1 ? (
      <Select
        value={boundKind}
        onValueChange={(value) => {
          if (value) {
            onKindChange(value as PaymentRouteSelectableParticipantOption["kind"]);
          }
        }}
      >
        <SelectTrigger
          aria-label="Тип участника"
          className="w-full min-w-0 max-w-[9.5rem]"
        >
          <SelectValue className="min-w-0">
            <span className="block min-w-0 truncate">
              {getParticipantKindLabel(boundKind)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {kindOptions.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {getParticipantKindLabel(kind)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  return (
    <div className="space-y-3">
      {showsBindingToggle ? (
        <ButtonGroup className="w-full">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onBindingChange("abstract")}
          >
            Любой
          </Button>
          <Button
            type="button"
            variant="default"
            className="flex-1"
            disabled={!canBindConcrete}
            onClick={() => onBindingChange("bound")}
          >
            Конкретный
          </Button>
        </ButtonGroup>
      ) : null}
      <div
        className={cn(
          "grid max-w-[36rem] gap-2",
          kindSelector ? "sm:grid-cols-[9.5rem_minmax(0,22rem)]" : null,
        )}
      >
        {kindSelector}
        <Select
          value={participant.entityId ?? ""}
          onValueChange={(nextValue) => {
            if (nextValue) {
              onEntityChange(nextValue);
            }
          }}
        >
          <SelectTrigger
            aria-label="Участник маршрута"
            className={cn(
              "w-full min-w-0 max-w-[22rem]",
              kindSelector ? null : "max-w-[36rem]",
            )}
          >
            <SelectValue
              placeholder="Выберите участника"
              className="min-w-0"
            >
              <span className="block min-w-0 truncate">
                {selectedOptionLabel}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {selectableOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {getSelectableOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
            fee.kind === "fixed"
              ? (fee.currencyId ?? fallbackCurrencyId)
              : fallbackCurrencyId;

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
                    <SelectValue>{getFeeKindLabel(fee.kind)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">
                      {getFeeKindLabel("fixed")}
                    </SelectItem>
                    <SelectItem value="percent">
                      {getFeeKindLabel("percent")}
                    </SelectItem>
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
