"use client";

import * as React from "react";

import { LoaderCircle } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { ButtonGroup } from "@bedrock/sdk-ui/components/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Field, FieldLabel } from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
} from "@bedrock/sdk-ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type {
  PaymentRouteCalculation,
  PaymentRouteDraft,
} from "@bedrock/treasury/contracts";

import {
  formatCurrencyMinorAmount,
  parseMajorToMinorAmount,
  type PaymentRouteCurrencyOption,
} from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";

type PaymentRouteSummaryRailProps = {
  calculation: PaymentRouteCalculation | null;
  className?: string;
  draft: PaymentRouteDraft;
  onAmountCommit: (amountMinor: string) => void;
  onCurrencyInChange: (currencyId: string) => void;
  onCurrencyOutChange: (currencyId: string) => void;
  onLockedSideChange: (side: PaymentRouteDraft["lockedSide"]) => void;
  options: PaymentRouteConstructorOptions;
  previewError?: string | null;
  previewPending?: boolean;
  sticky?: boolean;
};

function getCurrency(options: PaymentRouteConstructorOptions, currencyId: string) {
  return options.currencies.find((currency) => currency.id === currencyId) ?? null;
}

function formatAmountWithoutCurrency(
  amountMinor: string,
  currency: PaymentRouteCurrencyOption | null,
) {
  if (!currency) {
    return amountMinor;
  }

  return formatCurrencyMinorAmount(amountMinor, currency).replace(
    ` ${currency.code}`,
    "",
  );
}

type BufferedAmountInputProps = {
  ariaLabel: string;
  currency: PaymentRouteCurrencyOption | null;
  onCommit: (amountMinor: string) => void;
  valueMinor: string;
};

function BufferedAmountInput({
  ariaLabel,
  currency,
  onCommit,
  valueMinor,
}: BufferedAmountInputProps) {
  const initialValue = formatAmountWithoutCurrency(valueMinor, currency);
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(formatAmountWithoutCurrency(valueMinor, currency));
  }, [currency, valueMinor]);

  function commit(nextValue: string) {
    const parsed = parseMajorToMinorAmount({ currency, value: nextValue });

    if (!parsed) {
      setValue(formatAmountWithoutCurrency(valueMinor, currency));
      return;
    }

    onCommit(parsed);
    setValue(nextValue);
  }

  return (
    <Input
      aria-label={ariaLabel}
      data-slot="input-group-control"
      inputMode="decimal"
      className="rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent flex-1"
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

type AmountLineProps = {
  amountMinor: string;
  currency: PaymentRouteCurrencyOption | null;
  tone?: "default" | "negative";
  prefix?: string;
};

function AmountLine({ amountMinor, currency, tone = "default", prefix }: AmountLineProps) {
  const formatted = formatCurrencyMinorAmount(amountMinor, currency);
  const isNegative = BigInt(amountMinor) < 0n || tone === "negative";

  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        isNegative ? "text-destructive" : null,
      )}
    >
      {prefix && !isNegative ? `${prefix} ` : null}
      {formatted}
    </span>
  );
}

export function PaymentRouteSummaryRail({
  calculation,
  className,
  draft,
  onAmountCommit,
  onCurrencyInChange,
  onCurrencyOutChange,
  onLockedSideChange,
  options,
  previewError = null,
  previewPending = false,
  sticky = true,
}: PaymentRouteSummaryRailProps) {
  const currencyIn = getCurrency(options, draft.currencyInId);
  const currencyOut = getCurrency(options, draft.currencyOutId);
  const lockedSide = draft.lockedSide;
  const lockedCurrency = lockedSide === "currency_in" ? currencyIn : currencyOut;
  const lockedValueMinor =
    lockedSide === "currency_in" ? draft.amountInMinor : draft.amountOutMinor;
  const lockedCurrencyId =
    lockedSide === "currency_in" ? draft.currencyInId : draft.currencyOutId;
  const onLockedCurrencyChange =
    lockedSide === "currency_in" ? onCurrencyInChange : onCurrencyOutChange;

  const otherSideMinor =
    calculation !== null
      ? lockedSide === "currency_in"
        ? calculation.amountOutMinor
        : calculation.amountInMinor
      : null;
  const otherCurrency = lockedSide === "currency_in" ? currencyOut : currencyIn;
  const otherDisplay =
    otherSideMinor && otherCurrency
      ? formatCurrencyMinorAmount(otherSideMinor, otherCurrency)
      : null;

  const economics = React.useMemo(() => {
    if (!calculation) {
      return null;
    }

    return {
      deductedExecutionCostMinor: BigInt(
        calculation.deductedExecutionCostMinor,
      ),
      embeddedExecutionCostMinor: BigInt(
        calculation.embeddedExecutionCostMinor,
      ),
      legCount: calculation.legs.length,
      separateExecutionCostMinor: BigInt(
        calculation.separateExecutionCostMinor,
      ),
    };
  }, [calculation]);

  return (
    <Card className={cn(sticky ? "xl:sticky xl:top-6" : null, className)}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Экономика маршрута</CardTitle>
            <CardDescription>Пересчитывается при каждом изменении</CardDescription>
          </div>
          {previewPending ? (
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" />
              Пересчёт
            </div>
          ) : calculation ? (
            <div className="shrink-0 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(calculation.computedAt))}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3">
          <Field>
            <FieldLabel>Фиксировать</FieldLabel>
            <ButtonGroup className="w-full">
              <Button
                type="button"
                variant={lockedSide === "currency_in" ? "default" : "outline"}
                className="flex-1"
                onClick={() => onLockedSideChange("currency_in")}
              >
                Списание
              </Button>
              <Button
                type="button"
                variant={lockedSide === "currency_out" ? "default" : "outline"}
                className="flex-1"
                onClick={() => onLockedSideChange("currency_out")}
              >
                Получение
              </Button>
            </ButtonGroup>
          </Field>
          <Field>
            <FieldLabel>Сумма для расчёта</FieldLabel>
            <InputGroup>
              <BufferedAmountInput
                ariaLabel="Сумма для расчёта"
                currency={lockedCurrency}
                onCommit={onAmountCommit}
                valueMinor={lockedValueMinor}
              />
              <InputGroupAddon align="inline-end" className="p-0">
                <Select
                  value={lockedCurrencyId}
                  onValueChange={(nextValue) => {
                    if (nextValue) {
                      onLockedCurrencyChange(nextValue);
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="Валюта суммы"
                    className="h-full border-0 bg-transparent px-2 font-medium shadow-none focus-visible:ring-0"
                  >
                    <SelectValue>
                      {lockedCurrency?.code ?? "—"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {options.currencies.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
            {otherDisplay ? (
              <div className="text-xs text-muted-foreground">
                ≈ {otherDisplay}
              </div>
            ) : null}
            {previewError ? (
              <div className="text-xs text-destructive">{previewError}</div>
            ) : null}
          </Field>
        </div>

        {calculation && economics ? (
          <>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    Требуется завести в маршрут
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Сумма входа с учётом курса и списаний
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">
                  {formatCurrencyMinorAmount(
                    calculation.executionPrincipalInMinor,
                    currencyIn,
                  )}
                </div>
              </div>
              <div className="space-y-1 pl-3">
                <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                  <span className="min-w-0">Рыночная база</span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-foreground">
                    {formatCurrencyMinorAmount(
                      calculation.benchmarkPrincipalInMinor,
                      currencyIn,
                    )}
                  </span>
                </div>
                {economics.embeddedExecutionCostMinor > 0n ? (
                  <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                    <span className="min-w-0">Спред провайдера в курсе</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-foreground">
                      {formatCurrencyMinorAmount(
                        economics.embeddedExecutionCostMinor.toString(),
                        currencyIn,
                      )}
                    </span>
                  </div>
                ) : null}
                {economics.deductedExecutionCostMinor > 0n ? (
                  <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                    <span className="min-w-0">
                      Списания из потока ({economics.legCount})
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-foreground">
                      {formatCurrencyMinorAmount(
                        economics.deductedExecutionCostMinor.toString(),
                        currencyIn,
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator orientation="horizontal" className="h-px" />

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Себестоимость маршрута</div>
                  <div className="text-xs text-muted-foreground">
                    Сумма входа плюс отдельные расходы исполнения
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-destructive">
                  {formatCurrencyMinorAmount(
                    calculation.costPriceInMinor,
                    currencyIn,
                  )}
                </div>
              </div>
              {economics.separateExecutionCostMinor > 0n ? (
                <div className="space-y-1 pl-3">
                  <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                    <span className="min-w-0">
                      Отдельные расходы сверх потока
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-foreground">
                      {formatCurrencyMinorAmount(
                        economics.separateExecutionCostMinor.toString(),
                        currencyIn,
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <Separator orientation="horizontal" className="h-px" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Бенефициар получит</div>
                <div className="text-xs text-muted-foreground">
                  Чистая сумма к получению
                </div>
              </div>
              <div className="shrink-0 whitespace-nowrap">
                <AmountLine
                  amountMinor={calculation.amountOutMinor}
                  currency={currencyOut}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            После первого расчёта здесь появятся сумма входа, расходы
            исполнения и сумма к получению.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
