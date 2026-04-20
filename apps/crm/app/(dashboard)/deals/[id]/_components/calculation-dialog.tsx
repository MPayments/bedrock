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
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import {
  formatDate,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import type { ApiCurrency, ApiCurrencyOption, ApiQuotePreview } from "./types";

function parsePercent(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

const BPS_SCALE = 10_000n;

function calculateBpsAmountMinor(amountMinor: bigint, bps: bigint) {
  if (amountMinor === 0n || bps === 0n) {
    return 0n;
  }

  return (amountMinor * bps + BPS_SCALE / 2n) / BPS_SCALE;
}

type CalculationDialogProps = {
  amount: string;
  agreementFeePercentage: string;
  amountSide?: "source" | "target";
  asOf: string;
  currencyOptions: ApiCurrencyOption[];
  description?: string;
  disabledReason: string | null;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  isCreating: boolean;
  isPreviewLoading: boolean;
  loadingLabel?: string;
  onAmountChange: (value: string) => void;
  onAsOfChange: (value: string) => void;
  onCancel: () => void;
  onFixedFeeAmountChange: (value: string) => void;
  onFixedFeeCurrencyChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onQuoteMarkupPercentChange: (value: string) => void;
  onSubmit: () => void;
  onToCurrencyChange: (value: string) => void;
  onToggleOverride: (next: boolean) => void;
  open: boolean;
  overrideAmount: boolean;
  preview: ApiQuotePreview | null;
  previewError: string | null;
  quoteMarkupPercent: string;
  sourceCurrency: ApiCurrency | null;
  submitLabel?: string;
  title?: string;
  toCurrency: string;
};

export function CalculationDialog({
  open,
  onOpenChange,
  amount,
  agreementFeePercentage,
  amountSide = "source",
  asOf,
  currencyOptions,
  disabledReason,
  fixedFeeAmount,
  fixedFeeCurrencyCode,
  isCreating,
  isPreviewLoading,
  onAmountChange,
  onAsOfChange,
  onCancel,
  onFixedFeeAmountChange,
  onFixedFeeCurrencyChange,
  onQuoteMarkupPercentChange,
  onSubmit,
  onToCurrencyChange,
  onToggleOverride,
  overrideAmount,
  preview,
  previewError,
  quoteMarkupPercent,
  sourceCurrency,
  submitLabel = "Сохранить",
  title = "Создать расчет",
  toCurrency,
  description = "Создайте котировку и сохраните расчет для этой сделки.",
  loadingLabel = "Сохраняем...",
}: CalculationDialogProps) {
  const amountLabel =
    amountSide === "target" ? "Сумма оплаты" : "Сумма списания";
  const toCurrencyLabel =
    amountSide === "target" ? "Валюта оплаты" : "Валюта назначения";
  const formatCurrencyLabel = (code: string | null | undefined) => {
    if (!code) {
      return "—";
    }

    const option = currencyOptions.find((item) => item.code === code);
    return option ? `${option.name} (${option.code})` : code;
  };
  const totalFeePercentage = (
    parsePercent(agreementFeePercentage) + parsePercent(quoteMarkupPercent)
  ).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const previewRate = preview
    ? amountSide === "target"
      ? `1 ${formatCurrencyLabel(preview.toCurrency)} = ${rationalToDecimalString(
          preview.rateDen,
          preview.rateNum,
        )} ${formatCurrencyLabel(preview.fromCurrency)}`
      : `1 ${formatCurrencyLabel(preview.fromCurrency)} = ${rationalToDecimalString(
          preview.rateNum,
          preview.rateDen,
        )} ${formatCurrencyLabel(preview.toCurrency)}`
    : "—";
  const previewCommercialTerms = preview?.commercialTerms ?? null;
  const resolvedFromCurrencyPrecision =
    preview?.fromCurrency === sourceCurrency?.code
      ? (sourceCurrency?.precision ?? 2)
      : 2;
  const percentageFeeMinor =
    preview && previewCommercialTerms
      ? calculateBpsAmountMinor(
          BigInt(preview.fromAmountMinor),
          BigInt(previewCommercialTerms.totalFeeBps),
        )
      : 0n;
  const fixedFeeInFromCurrencyMinor =
    preview &&
    previewCommercialTerms?.fixedFeeAmountMinor &&
    previewCommercialTerms.fixedFeeCurrency === preview.fromCurrency
      ? BigInt(previewCommercialTerms.fixedFeeAmountMinor)
      : 0n;
  const totalCustomerDebitMinor = preview
    ? BigInt(preview.fromAmountMinor) +
      percentageFeeMinor +
      fixedFeeInFromCurrencyMinor
    : 0n;
  const effectiveCustomerRate = preview
    ? amountSide === "target"
      ? `1 ${formatCurrencyLabel(preview.toCurrency)} = ${rationalToDecimalString(
          totalCustomerDebitMinor.toString(),
          preview.toAmountMinor,
        )} ${formatCurrencyLabel(preview.fromCurrency)}`
      : `1 ${formatCurrencyLabel(preview.fromCurrency)} = ${rationalToDecimalString(
          preview.toAmountMinor,
          totalCustomerDebitMinor.toString(),
        )} ${formatCurrencyLabel(preview.toCurrency)}`
    : "—";
  const totalCustomerDebit = preview
    ? `${minorToDecimalString(
        totalCustomerDebitMinor.toString(),
        resolvedFromCurrencyPrecision,
      )} ${formatCurrencyLabel(preview.fromCurrency)}`
    : "—";
  const extraFixedFee =
    previewCommercialTerms?.fixedFeeAmountMinor &&
    previewCommercialTerms.fixedFeeCurrency &&
    previewCommercialTerms.fixedFeeCurrency !== preview?.fromCurrency
      ? `${minorToDecimalString(
          previewCommercialTerms.fixedFeeAmountMinor,
          2,
        )} ${formatCurrencyLabel(previewCommercialTerms.fixedFeeCurrency)}`
      : null;
  const previewSummaryItems = preview
    ? [
        {
          label: "Базовый курс",
          value: previewRate,
        },
        {
          label: "Итоговый курс клиента",
          value: effectiveCustomerRate,
        },
        {
          label: "Списание клиента",
          value: totalCustomerDebit,
        },
        {
          label: "Получение",
          value: `${preview.toAmount} ${formatCurrencyLabel(preview.toCurrency)}`,
        },
        ...(extraFixedFee
          ? [
              {
                label: "Отдельная фиксированная комиссия",
                value: extraFixedFee,
              },
            ]
          : []),
        {
          label: "Котировка действует до",
          value: formatDate(preview.expiresAt),
        },
      ]
    : [];

  const amountField = (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="deal-calculation-amount">{amountLabel}</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            id="deal-calculation-amount-override"
            data-testid="deal-quote-override-amount-checkbox"
            checked={overrideAmount}
            onCheckedChange={(checked) => onToggleOverride(Boolean(checked))}
          />
          <Label
            htmlFor="deal-calculation-amount-override"
            className="text-xs text-muted-foreground"
          >
            Изменить сумму
          </Label>
        </div>
      </div>
      <Input
        id="deal-calculation-amount"
        data-testid="deal-quote-amount-input"
        disabled={!overrideAmount}
        inputMode="decimal"
        placeholder="Например 1000.00"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
      />
    </div>
  );

  const toCurrencyField = (
    <div className="grid gap-2">
      <Label>{toCurrencyLabel}</Label>
      <Select
        value={toCurrency}
        onValueChange={(value) => onToCurrencyChange(value ?? "")}
      >
        <SelectTrigger
          data-testid="deal-quote-to-currency-select"
          disabled={amountSide === "target"}
        >
          <SelectValue placeholder="Выберите валюту" />
        </SelectTrigger>
        <SelectContent>
          {currencyOptions
            .filter((option) => option.code !== sourceCurrency?.code)
            .map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-3rem)] flex-col sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto py-2 pr-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-4">
            <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <Label>Валюта списания</Label>
              <Input
                disabled
                value={formatCurrencyLabel(sourceCurrency?.code)}
              />
            </div>
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
              <div className="text-sm font-medium">Параметры котировки</div>
              <div
                className={
                  amountSide === "target"
                    ? "grid grid-cols-[minmax(0,1fr)_11rem] gap-3"
                    : "grid gap-4"
                }
              >
                {amountField}
                {amountSide === "target" ? toCurrencyField : null}
              </div>
              {amountSide === "target" ? null : toCurrencyField}
              <div className="grid gap-2">
                <Label htmlFor="deal-calculation-asof">Дата котировки</Label>
                <Input
                  id="deal-calculation-asof"
                  data-testid="deal-quote-asof-input"
                  type="datetime-local"
                  value={asOf}
                  onChange={(event) => onAsOfChange(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
              <div className="text-sm font-medium">Коммерческие условия</div>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Договорная комиссия</span>
                  <span className="font-medium text-foreground">
                    {agreementFeePercentage || "0"}%
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-quote-markup-percent">
                  Надбавка к котировке (%)
                </Label>
                <Input
                  id="deal-quote-markup-percent"
                  data-testid="deal-quote-markup-input"
                  inputMode="decimal"
                  placeholder="Например 0.5"
                  value={quoteMarkupPercent}
                  onChange={(event) =>
                    onQuoteMarkupPercentChange(event.target.value)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-fixed-fee-amount">
                  Фиксированная комиссия для котировки
                </Label>
                <div className="grid grid-cols-[minmax(0,1fr)_11rem] gap-3">
                  <Input
                    id="deal-fixed-fee-amount"
                    data-testid="deal-quote-fixed-fee-amount-input"
                    inputMode="decimal"
                    placeholder="Например 25.00"
                    value={fixedFeeAmount}
                    onChange={(event) =>
                      onFixedFeeAmountChange(event.target.value)
                    }
                  />
                  <Select
                    value={fixedFeeCurrencyCode ?? undefined}
                    onValueChange={(value) =>
                      onFixedFeeCurrencyChange(value || "")
                    }
                  >
                    <SelectTrigger data-testid="deal-quote-fixed-fee-currency-select">
                      <SelectValue placeholder="Валюта" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Поле можно оставить пустым, если для этой котировки
                  фиксированная комиссия не нужна.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Суммарная комиссия
                </span>
                <span className="font-medium">{totalFeePercentage}%</span>
              </div>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  Предпросмотр котировки
                </div>
                <div className="text-xs text-muted-foreground">
                  {isPreviewLoading ? "Пересчитываем..." : "Live preview"}
                </div>
              </div>
              {previewError ? (
                <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
                  {previewError}
                </div>
              ) : preview ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {previewSummaryItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border bg-background px-3 py-2"
                    >
                      <div className="text-xs text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 wrap-break-word text-sm font-medium text-foreground">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
                  Курс появится здесь сразу после расчета предварительной
                  котировки.
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            data-testid="deal-create-quote-confirm"
            onClick={onSubmit}
            disabled={isCreating || Boolean(disabledReason)}
          >
            {isCreating ? loadingLabel : disabledReason}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
