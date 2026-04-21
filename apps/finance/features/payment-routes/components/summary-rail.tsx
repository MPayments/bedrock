"use client";

import * as React from "react";
import Link from "next/link";

import { AlertTriangle, ExternalLink, LoaderCircle } from "lucide-react";

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
  PaymentRouteCalculationFee,
  PaymentRouteDraft,
} from "@bedrock/treasury/contracts";

import {
  formatCurrencyMinorAmount,
  parseMajorToMinorAmount,
  type PaymentRouteCurrencyOption,
} from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteRequisiteWarning } from "../lib/requisites";

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
  warnings?: PaymentRouteRequisiteWarning[];
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

function sumInputImpactInCurrency(
  fees: PaymentRouteCalculationFee[],
  currencyId: string,
) {
  return fees.reduce((acc, fee) => {
    if (fee.inputImpactCurrencyId !== currencyId) {
      return acc;
    }

    return acc + BigInt(fee.inputImpactMinor);
  }, 0n);
}

function formatBps(marginMinor: bigint, grossMinor: bigint) {
  if (grossMinor <= 0n) {
    return "—";
  }

  const negative = marginMinor < 0n;
  const absoluteMargin = negative ? -marginMinor : marginMinor;
  const scaled = (absoluteMargin * 100000n + grossMinor / 2n) / grossMinor;
  const whole = scaled / 10n;
  const fraction = scaled % 10n;
  const sign = negative ? "−" : "";

  return `${sign}${whole.toString()},${fraction.toString()} bps`;
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
  warnings = [],
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

    const legFees = calculation.legs.flatMap((leg) => leg.fees);
    const chargedLegFees = legFees.filter((fee) => fee.chargeToCustomer);
    const internalLegFees = legFees.filter((fee) => !fee.chargeToCustomer);
    const chargedAdditionalFees = calculation.additionalFees.filter(
      (fee) => fee.chargeToCustomer,
    );
    const internalAdditionalFees = calculation.additionalFees.filter(
      (fee) => !fee.chargeToCustomer,
    );

    const internalLegImpact = sumInputImpactInCurrency(
      internalLegFees,
      calculation.currencyInId,
    );
    const chargedImpact = sumInputImpactInCurrency(
      [...chargedLegFees, ...chargedAdditionalFees],
      calculation.currencyInId,
    );
    const internalAdditionalImpact = sumInputImpactInCurrency(
      internalAdditionalFees,
      calculation.currencyInId,
    );

    const marginInMinor = chargedImpact - internalAdditionalImpact;
    const grossInMinor = BigInt(calculation.amountInMinor);

    return {
      chargedFeeRows: [...chargedLegFees, ...chargedAdditionalFees],
      internalAdditionalFees,
      internalLegImpact,
      legCount: calculation.legs.length,
      marginInMinor,
      marginBps: formatBps(marginInMinor, grossInMinor),
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
      <CardContent className="space-y-5">
        {warnings.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="size-4" />
              Шаблон требует реквизитов
            </div>
            <div className="space-y-3">
              {warnings.map((warning) => (
                <div
                  key={`${warning.participantNodeId}:${warning.message}`}
                  className="rounded-xl border border-amber-200/80 bg-background/70 p-3"
                >
                  <div className="text-sm font-medium">{warning.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {warning.message}
                  </div>
                  {warning.createHref ? (
                    <div className="mt-3">
                      <Button
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                        render={
                          <Link
                            href={warning.createHref}
                            rel="noopener noreferrer"
                            target="_blank"
                          />
                        }
                      >
                        <ExternalLink className="size-4" />
                        Создать реквизит
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
            <Separator />

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Клиент оплатит</div>
                  <div className="text-xs text-muted-foreground">
                    Брутто + учтённые комиссии
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatCurrencyMinorAmount(
                    calculation.clientTotalInMinor,
                    currencyIn,
                  )}
                </div>
              </div>
              {economics.chargedFeeRows.length > 0 ? (
                <div className="space-y-1 pl-3">
                  {economics.chargedFeeRows.map((fee) => (
                    <div
                      key={fee.id}
                      className="flex items-start justify-between gap-3 text-sm text-muted-foreground"
                    >
                      <span className="truncate">
                        + {fee.label ?? "Комиссия"}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {formatCurrencyMinorAmount(
                          fee.amountMinor,
                          getCurrency(options, fee.currencyId),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Себестоимость</div>
                  <div className="text-xs text-muted-foreground">
                    Комиссии провайдеров и внутренние расходы
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-destructive">
                  −{" "}
                  {formatCurrencyMinorAmount(
                    calculation.costPriceInMinor,
                    currencyIn,
                  )}
                </div>
              </div>
              <div className="space-y-1 pl-3">
                <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    − Комиссии провайдеров по шагам ({economics.legCount})
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrencyMinorAmount(
                      economics.internalLegImpact.toString(),
                      currencyIn,
                    )}
                  </span>
                </div>
                {economics.internalAdditionalFees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-start justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="truncate">− {fee.label ?? "Расход"}</span>
                    <span className="tabular-nums text-foreground">
                      {formatCurrencyMinorAmount(
                        fee.amountMinor,
                        getCurrency(options, fee.currencyId),
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Бенефициар получит</div>
                <div className="text-xs text-muted-foreground">
                  Чистая сумма к получению
                </div>
              </div>
              <AmountLine
                amountMinor={calculation.amountOutMinor}
                currency={currencyOut}
              />
            </div>

            <div className="space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-900">
                    Чистая маржа
                  </div>
                  <div className="text-xs text-emerald-700/80 tabular-nums">
                    {economics.marginBps} от брутто
                  </div>
                </div>
                <div className="text-base font-semibold tabular-nums text-emerald-900">
                  {formatCurrencyMinorAmount(
                    economics.marginInMinor.toString(),
                    currencyIn,
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            После первого расчёта здесь появятся итоги: что заплатит клиент,
            себестоимость маршрута и чистая маржа.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
