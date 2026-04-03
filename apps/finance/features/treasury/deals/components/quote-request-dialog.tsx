"use client";

import { useEffect, useState } from "react";

import {
  CurrencyOptionsResponseSchema,
  CurrencySchema,
} from "@bedrock/currencies/contracts";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";
import {
  decimalRateToFraction,
  decimalToMinorString,
  resolveDefaultToCurrency,
  type CurrencyOptionItem,
} from "./quote-request-utils";

type QuoteRequestDialogProps = {
  dealId: string;
  disabledReason: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
  requestedAmount: string | null;
  requestedCurrencyId: string | null;
  targetCurrencyId: string | null;
};

function formatDateTimeInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function QuoteRequestDialog({
  dealId,
  disabledReason,
  onOpenChange,
  onSuccess,
  open,
  requestedAmount,
  requestedCurrencyId,
  targetCurrencyId,
}: QuoteRequestDialogProps) {
  const [amount, setAmount] = useState(requestedAmount ?? "");
  const [asOf, setAsOf] = useState(formatDateTimeInput(new Date()));
  const [toCurrency, setToCurrency] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [manualRateEnabled, setManualRateEnabled] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestedCurrency, setRequestedCurrency] = useState<{
    code: string;
    precision: number;
  } | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOptionItem[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setAmount(requestedAmount ?? "");
    setAsOf(formatDateTimeInput(new Date()));
    setManualRate("");
    setManualRateEnabled(false);
    setOverrideAmount(false);
  }, [open, requestedAmount]);

  useEffect(() => {
    if (!open || !requestedCurrencyId) {
      return;
    }

    const currentRequestedCurrencyId = requestedCurrencyId;
    let cancelled = false;

    async function loadContext() {
      setLoadingContext(true);

      try {
        const [currencyResponse, optionsResponse] = await Promise.all([
          fetch(`/v1/currencies/${encodeURIComponent(currentRequestedCurrencyId)}`, {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/v1/currencies/options", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        if (!currencyResponse.ok) {
          throw new Error("Не удалось загрузить валюту сделки");
        }

        if (!optionsResponse.ok) {
          throw new Error("Не удалось загрузить валюты");
        }

        const nextRequestedCurrency = CurrencySchema.parse(
          await currencyResponse.json(),
        );
        const nextOptions = CurrencyOptionsResponseSchema.parse(
          await optionsResponse.json(),
        );

        if (cancelled) {
          return;
        }

        const availableOptions = nextOptions.data
          .filter((item) => item.code !== nextRequestedCurrency.code)
          .map((item) => ({
            code: item.code,
            id: item.id,
            label: item.label,
          }));

        setRequestedCurrency({
          code: nextRequestedCurrency.code,
          precision: nextRequestedCurrency.precision,
        });
        setCurrencyOptions(availableOptions);
        setToCurrency((currentValue) =>
          resolveDefaultToCurrency({
            currentValue,
            options: availableOptions,
            preferredTargetCurrencyId: targetCurrencyId,
            sourceCurrencyCode: nextRequestedCurrency.code,
          }),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось подготовить форму котировки",
        );
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [open, requestedCurrencyId, targetCurrencyId]);

  async function handleSubmit() {
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    if (!requestedCurrency) {
      toast.error("Не удалось определить валюту сделки");
      return;
    }

    if (!toCurrency) {
      toast.error("Выберите валюту назначения");
      return;
    }

    if (requestedCurrency.code === toCurrency) {
      toast.error("Выберите другую валюту назначения");
      return;
    }

    const amountMinor = decimalToMinorString(amount, requestedCurrency.precision);

    if (!amountMinor || BigInt(amountMinor) <= 0n) {
      toast.error("Введите сумму больше нуля в формате 1000.00");
      return;
    }

    const asOfDate = asOf ? new Date(asOf) : new Date();

    if (Number.isNaN(asOfDate.getTime())) {
      toast.error("Выберите корректную дату котировки");
      return;
    }

    if (manualRateEnabled && !decimalRateToFraction(manualRate)) {
      toast.error("Введите корректный ручной курс, например 97.15");
      return;
    }

    setSubmitting(true);

    const result = await executeMutation<{ id: string }>({
      fallbackMessage: "Не удалось запросить котировку",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(dealId)}/quotes`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify(
            manualRateEnabled
              ? buildManualQuotePayload({
                  asOf: asOfDate.toISOString(),
                  fromAmountMinor: amountMinor,
                  fromCurrency: requestedCurrency.code,
                  manualRate,
                  toCurrency,
                })
              : {
                  mode: "auto_cross",
                  fromAmountMinor: amountMinor,
                  fromCurrency: requestedCurrency.code,
                  toCurrency,
                  asOf: asOfDate.toISOString(),
                },
          ),
        }),
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Котировка запрошена");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Запросить котировку</DialogTitle>
          <DialogDescription>
            Получите котировку для сделки. После этого ее можно принять и создать
            расчет.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Валюта списания</Label>
            <Input disabled value={requestedCurrency?.code ?? "—"} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deal-quote-amount">Сумма</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="deal-quote-amount-override"
                  checked={overrideAmount}
                  onCheckedChange={(checked) =>
                    setOverrideAmount(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="deal-quote-amount-override"
                  className="text-xs text-muted-foreground"
                >
                  Изменить сумму
                </Label>
              </div>
            </div>
            <Input
              id="deal-quote-amount"
              disabled={!overrideAmount}
              placeholder="Например 1000.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Валюта назначения</Label>
            <Select value={toCurrency} onValueChange={(value) => setToCurrency(value ?? "")}>
              <SelectTrigger disabled={loadingContext}>
                <SelectValue
                  placeholder={
                    loadingContext ? "Загружаем валюты..." : "Выберите валюту"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deal-quote-manual-rate">Курс</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="deal-quote-manual-rate-enabled"
                  checked={manualRateEnabled}
                  onCheckedChange={(checked) =>
                    setManualRateEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="deal-quote-manual-rate-enabled"
                  className="text-xs text-muted-foreground"
                >
                  Ручной курс
                </Label>
              </div>
            </div>
            <Input
              id="deal-quote-manual-rate"
              disabled={!manualRateEnabled}
              placeholder={
                requestedCurrency && toCurrency
                  ? `Например 97.15 ${toCurrency} за 1 ${requestedCurrency.code}`
                  : "Например 97.15"
              }
              value={manualRate}
              onChange={(event) => setManualRate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-quote-as-of">Дата котировки</Label>
            <Input
              id="deal-quote-as-of"
              type="datetime-local"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </div>
          {disabledReason ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {disabledReason}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={Boolean(disabledReason) || loadingContext || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Запрашиваем..." : "Запросить котировку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildManualQuotePayload(input: {
  asOf: string;
  fromAmountMinor: string;
  fromCurrency: string;
  manualRate: string;
  toCurrency: string;
}) {
  const rate = decimalRateToFraction(input.manualRate);

  if (!rate) {
    throw new Error("Введите корректный ручной курс, например 97.15");
  }

  return {
    mode: "explicit_route",
    fromAmountMinor: input.fromAmountMinor,
    fromCurrency: input.fromCurrency,
    toCurrency: input.toCurrency,
    asOf: input.asOf,
    pricingTrace: {
      version: "v1",
      mode: "explicit_route",
      summary: "Курс задан вручную в рабочем столе сделки",
      metadata: {
        source: "finance_manual_rate",
      },
    },
    legs: [
      {
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rateNum: rate.rateNum,
        rateDen: rate.rateDen,
        sourceKind: "manual",
        sourceRef: "finance-workbench",
      },
    ],
  };
}
