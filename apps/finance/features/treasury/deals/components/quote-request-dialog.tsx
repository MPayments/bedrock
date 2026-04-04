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
  quoteAmount: string | null;
  quoteAmountSide: "source" | "target";
  sourceCurrencyId: string | null;
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
  quoteAmount,
  quoteAmountSide,
  sourceCurrencyId,
  targetCurrencyId,
}: QuoteRequestDialogProps) {
  const [amount, setAmount] = useState(quoteAmount ?? "");
  const [asOf, setAsOf] = useState(formatDateTimeInput(new Date()));
  const [toCurrency, setToCurrency] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [manualRateEnabled, setManualRateEnabled] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sourceCurrency, setSourceCurrency] = useState<{
    code: string;
    precision: number;
  } | null>(null);
  const [targetQuoteCurrency, setTargetQuoteCurrency] = useState<{
    code: string;
    precision: number;
  } | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOptionItem[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setAmount(quoteAmount ?? "");
    setAsOf(formatDateTimeInput(new Date()));
    setManualRate("");
    setManualRateEnabled(false);
    setOverrideAmount(false);
  }, [open, quoteAmount]);

  useEffect(() => {
    if (!open || !sourceCurrencyId) {
      return;
    }

    const currentSourceCurrencyId = sourceCurrencyId;
    let cancelled = false;

    async function loadContext() {
      setLoadingContext(true);

      try {
        const sourceCurrencyRequest = fetch(
          `/v1/currencies/${encodeURIComponent(currentSourceCurrencyId)}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const optionsRequest = fetch("/v1/currencies/options", {
          cache: "no-store",
          credentials: "include",
        });
        const targetCurrencyRequest =
          quoteAmountSide === "target" && targetCurrencyId
            ? fetch(`/v1/currencies/${encodeURIComponent(targetCurrencyId)}`, {
                cache: "no-store",
                credentials: "include",
              })
            : Promise.resolve(null);
        const [sourceCurrencyResponse, optionsResponse, targetCurrencyResponse] =
          await Promise.all([
            sourceCurrencyRequest,
            optionsRequest,
            targetCurrencyRequest,
          ]);

        if (!sourceCurrencyResponse.ok) {
          throw new Error("Не удалось загрузить валюту сделки");
        }

        if (!optionsResponse.ok) {
          throw new Error("Не удалось загрузить валюты");
        }

        if (
          quoteAmountSide === "target" &&
          targetCurrencyId &&
          targetCurrencyResponse &&
          !targetCurrencyResponse.ok
        ) {
          throw new Error("Не удалось загрузить валюту оплаты");
        }

        const nextSourceCurrency = CurrencySchema.parse(
          await sourceCurrencyResponse.json(),
        );
        const nextOptions = CurrencyOptionsResponseSchema.parse(
          await optionsResponse.json(),
        );
        const nextTargetCurrency =
          quoteAmountSide === "target" &&
          targetCurrencyId &&
          targetCurrencyResponse
            ? CurrencySchema.parse(await targetCurrencyResponse.json())
            : null;

        if (cancelled) {
          return;
        }

        const availableOptions = nextOptions.data
          .filter((item) => item.code !== nextSourceCurrency.code)
          .map((item) => ({
            code: item.code,
            id: item.id,
            label: item.label,
          }));

        setSourceCurrency({
          code: nextSourceCurrency.code,
          precision: nextSourceCurrency.precision,
        });
        if (quoteAmountSide === "target") {
          const fixedTargetCode = nextTargetCurrency?.code ?? "";
          const fixedTargetOption = availableOptions.find(
            (item) => item.id === targetCurrencyId,
          );
          setTargetQuoteCurrency(
            nextTargetCurrency
              ? {
                  code: nextTargetCurrency.code,
                  precision: nextTargetCurrency.precision,
                }
              : null,
          );
          setCurrencyOptions(fixedTargetOption ? [fixedTargetOption] : []);
          setToCurrency(fixedTargetCode);
        } else {
          setTargetQuoteCurrency(null);
          setCurrencyOptions(availableOptions);
          setToCurrency((currentValue) =>
            resolveDefaultToCurrency({
              currentValue,
              options: availableOptions,
              preferredTargetCurrencyId: targetCurrencyId,
              sourceCurrencyCode: nextSourceCurrency.code,
            }),
          );
        }
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
  }, [open, quoteAmountSide, sourceCurrencyId, targetCurrencyId]);

  async function handleSubmit() {
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    if (!sourceCurrency) {
      toast.error("Не удалось определить валюту сделки");
      return;
    }

    if (!toCurrency) {
      toast.error("Выберите валюту назначения");
      return;
    }

    if (sourceCurrency.code === toCurrency) {
      toast.error("Выберите другую валюту назначения");
      return;
    }

    const amountPrecision =
      quoteAmountSide === "target"
        ? targetQuoteCurrency?.precision
        : sourceCurrency.precision;
    const amountMinor =
      amountPrecision == null
        ? null
        : decimalToMinorString(amount, amountPrecision);

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
                  amountMinor,
                  amountSide: quoteAmountSide,
                  fromCurrency: sourceCurrency.code,
                  manualRate,
                  toCurrency,
                })
              : {
                  mode: "auto_cross",
                  ...(quoteAmountSide === "target"
                    ? { toAmountMinor: amountMinor }
                    : { fromAmountMinor: amountMinor }),
                  fromCurrency: sourceCurrency.code,
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
            <Input disabled value={sourceCurrency?.code ?? "—"} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deal-quote-amount">
                {quoteAmountSide === "target" ? "Сумма оплаты" : "Сумма списания"}
              </Label>
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
              inputMode="decimal"
              placeholder="Например 1000.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              {quoteAmountSide === "target"
                ? "Валюта оплаты"
                : "Валюта назначения"}
            </Label>
            <Select value={toCurrency} onValueChange={(value) => setToCurrency(value ?? "")}>
              <SelectTrigger
                disabled={loadingContext || quoteAmountSide === "target"}
              >
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
                sourceCurrency && toCurrency
                  ? `Например 97.15 ${toCurrency} за 1 ${sourceCurrency.code}`
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
  amountMinor: string;
  amountSide: "source" | "target";
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
    ...(input.amountSide === "target"
      ? { toAmountMinor: input.amountMinor }
      : { fromAmountMinor: input.amountMinor }),
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
