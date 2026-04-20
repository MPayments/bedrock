"use client";

import { AlertCircle, ArrowRight, Calculator, Check, Copy, Download, Lock, Mail, RefreshCcw } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import { formatCurrency, minorToDecimalString, rationalToDecimalString } from "./format";
import type {
  ApiCurrencyOption,
  ApiDealAcceptedQuote,
  ApiDealPricingQuote,
  ApiDealWorkflowProjection,
  CalculationView,
  DealStatus,
} from "./types";

type CalculatingPaneProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  calculation: CalculationView | null;
  calculationAmount: string;
  currencyOptions: ApiCurrencyOption[];
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  intake: ApiDealWorkflowProjection["intake"];
  isCreatingCalculation: boolean;
  isCreatingQuote: boolean;
  isUpdatingStatus: boolean;
  netMarginInBase: number | null;
  onAmountChange: (value: string) => void;
  onCreateCalculation: () => void;
  onCreateQuote: () => void;
  onEditInputs: () => void;
  onFixedFeeAmountChange: (value: string) => void;
  onFixedFeeCurrencyChange: (value: string) => void;
  onQuoteMarkupPercentChange: (value: string) => void;
  onSendCalcPdf?: () => void;
  onSendToCustomer?: () => void;
  onStatusChange: (status: DealStatus) => void;
  onToCurrencyChange: (value: string) => void;
  quoteMarkupPercent: string;
  quotes: ApiDealPricingQuote[];
  readOnly?: boolean;
  toCurrency: string;
};

export function CalculatingPane({
  acceptedQuote,
  calculation,
  calculationAmount,
  currencyOptions,
  fixedFeeAmount,
  fixedFeeCurrencyCode,
  intake,
  isCreatingCalculation,
  isCreatingQuote,
  isUpdatingStatus,
  netMarginInBase,
  onAmountChange,
  onCreateCalculation,
  onCreateQuote,
  onEditInputs,
  onFixedFeeAmountChange,
  onFixedFeeCurrencyChange,
  onQuoteMarkupPercentChange,
  onSendCalcPdf,
  onSendToCustomer,
  onStatusChange,
  onToCurrencyChange,
  quoteMarkupPercent,
  quotes,
  readOnly,
  toCurrency,
}: CalculatingPaneProps) {
  const activeQuote =
    quotes.find((q) => q.id === acceptedQuote?.quoteId) ??
    quotes.find((q) => q.status === "active") ??
    null;
  const acceptedRate = activeQuote
    ? rationalToDecimalString(activeQuote.rateNum, activeQuote.rateDen)
    : null;
  const currentRate = calculation?.finalRate ?? null;
  const deviationInfo = computeDeviation(acceptedRate, currentRate);

  return (
    <div className="stage-pane">
      <PromiseCallout
        acceptedRate={acceptedRate}
        calculation={calculation}
        currentRate={currentRate}
        deviation={deviationInfo}
        onCreateCalculation={onCreateCalculation}
        isCreatingCalculation={isCreatingCalculation}
        readOnly={readOnly}
      />
      <InputsCard
        amount={calculationAmount}
        currencyOptions={currencyOptions}
        fixedFeeAmount={fixedFeeAmount}
        fixedFeeCurrencyCode={fixedFeeCurrencyCode}
        intake={intake}
        isCreatingQuote={isCreatingQuote}
        onAmountChange={onAmountChange}
        onCreateQuote={onCreateQuote}
        onEditInputs={onEditInputs}
        onFixedFeeAmountChange={onFixedFeeAmountChange}
        onFixedFeeCurrencyChange={onFixedFeeCurrencyChange}
        onQuoteMarkupPercentChange={onQuoteMarkupPercentChange}
        onToCurrencyChange={onToCurrencyChange}
        quoteMarkupPercent={quoteMarkupPercent}
        readOnly={readOnly}
        toCurrency={toCurrency}
      />
      <FeeBreakdownCard calculation={calculation} />
      <QuoteSummaryCard
        calculation={calculation}
        netMarginInBase={netMarginInBase}
      />
      <ValidityLockCard
        calculation={calculation}
        deviation={deviationInfo}
        intake={intake}
        isUpdatingStatus={isUpdatingStatus}
        onSendCalcPdf={onSendCalcPdf}
        onSendToCustomer={onSendToCustomer}
        onStatusChange={onStatusChange}
        quote={activeQuote}
        readOnly={readOnly}
      />
    </div>
  );
}

type DeviationInfo =
  | { kind: "none" }
  | { kind: "within"; percent: string }
  | { kind: "above"; percent: string };

function computeDeviation(
  accepted: string | null,
  current: string | null,
): DeviationInfo {
  if (!accepted || !current) return { kind: "none" };
  const a = Number(accepted);
  const c = Number(current);
  if (!Number.isFinite(a) || !Number.isFinite(c) || a === 0) {
    return { kind: "none" };
  }
  const delta = Math.abs(c - a) / a;
  const pct = (delta * 100).toFixed(2);
  return delta <= 0.001
    ? { kind: "within", percent: pct }
    : { kind: "above", percent: pct };
}

function PromiseCallout({
  acceptedRate,
  calculation,
  currentRate,
  deviation,
  isCreatingCalculation,
  onCreateCalculation,
  readOnly,
}: {
  acceptedRate: string | null;
  calculation: CalculationView | null;
  currentRate: string | null;
  deviation: DeviationInfo;
  isCreatingCalculation: boolean;
  onCreateCalculation: () => void;
  readOnly?: boolean;
}) {
  if (!calculation) {
    return (
      <div className="callout warn">
        <AlertCircle className="callout-icon h-[14px] w-[14px]" />
        <span className="flex-1">
          Расчёт ещё не создан — клиент принял индикативное предложение,
          подтвердите окончательные параметры.
        </span>
        {!readOnly ? (
          <Button
            size="sm"
            onClick={onCreateCalculation}
            disabled={isCreatingCalculation}
          >
            <Calculator className="h-4 w-4" />
            Создать расчёт
          </Button>
        ) : null}
      </div>
    );
  }

  if (deviation.kind === "within" && acceptedRate && currentRate) {
    return (
      <div className="callout">
        <Check className="callout-icon h-[14px] w-[14px]" />
        <span>
          В рамках обещанного: клиент принял{" "}
          <b className="font-mono">{acceptedRate}</b>, текущая котировка{" "}
          <b className="font-mono">{currentRate}</b> ({deviation.percent}%).
        </span>
      </div>
    );
  }

  if (deviation.kind === "above" && acceptedRate && currentRate) {
    return (
      <div className="callout warn">
        <AlertCircle className="callout-icon h-[14px] w-[14px]" />
        <span>
          Вышли за границы обещания: клиент принял{" "}
          <b className="font-mono">{acceptedRate}</b>, текущая котировка{" "}
          <b className="font-mono">{currentRate}</b> (+{deviation.percent}%).
          Подтвердите с клиентом до фиксации.
        </span>
      </div>
    );
  }

  return (
    <div className="callout info">
      <Calculator className="callout-icon h-[14px] w-[14px]" />
      <span>
        Калькуляция зафиксирована. Проверьте итоговые значения ниже и нажмите
        «Принять» чтобы перейти к согласованию.
      </span>
    </div>
  );
}

function InputsCard({
  amount,
  currencyOptions,
  fixedFeeAmount,
  fixedFeeCurrencyCode,
  intake,
  isCreatingQuote,
  onAmountChange,
  onCreateQuote,
  onEditInputs,
  onFixedFeeAmountChange,
  onFixedFeeCurrencyChange,
  onQuoteMarkupPercentChange,
  onToCurrencyChange,
  quoteMarkupPercent,
  readOnly,
  toCurrency,
}: {
  amount: string;
  currencyOptions: ApiCurrencyOption[];
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  intake: ApiDealWorkflowProjection["intake"];
  isCreatingQuote: boolean;
  onAmountChange: (value: string) => void;
  onCreateQuote: () => void;
  onEditInputs: () => void;
  onFixedFeeAmountChange: (value: string) => void;
  onFixedFeeCurrencyChange: (value: string) => void;
  onQuoteMarkupPercentChange: (value: string) => void;
  onToCurrencyChange: (value: string) => void;
  quoteMarkupPercent: string;
  readOnly?: boolean;
  toCurrency: string;
}) {
  const sourceCurrency = currencyOptions.find(
    (option) => option.id === intake.moneyRequest.sourceCurrencyId,
  );
  const availableToCurrencies = currencyOptions.filter(
    (option) => option.code !== sourceCurrency?.code,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inputs</CardTitle>
        <CardDescription>
          Измените любой параметр — итоги пересчитаются ниже
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onEditInputs}>
            <RefreshCcw className="h-4 w-4" />
            Открыть полный диалог
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="calc-amount">Сумма ({sourceCurrency?.code ?? "—"})</Label>
            <Input
              id="calc-amount"
              inputMode="decimal"
              value={amount}
              disabled={readOnly}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Валюта назначения</Label>
            <Select
              value={toCurrency}
              onValueChange={(value) => onToCurrencyChange(value ?? "")}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                {availableToCurrencies.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calc-markup">Маржа (%)</Label>
            <Input
              id="calc-markup"
              inputMode="decimal"
              value={quoteMarkupPercent}
              disabled={readOnly}
              onChange={(event) =>
                onQuoteMarkupPercentChange(event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calc-fixed-fee">Фикс. комиссия</Label>
            <Input
              id="calc-fixed-fee"
              inputMode="decimal"
              value={fixedFeeAmount}
              disabled={readOnly}
              onChange={(event) => onFixedFeeAmountChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Валюта комиссии</Label>
            <Select
              value={fixedFeeCurrencyCode ?? ""}
              onValueChange={(value) => onFixedFeeCurrencyChange(value ?? "")}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!readOnly ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={onCreateQuote}
              disabled={isCreatingQuote}
            >
              <Calculator className="h-4 w-4" />
              Пересчитать котировку
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeeBreakdownCard({ calculation }: { calculation: CalculationView | null }) {
  if (!calculation) return null;

  const rows: Array<{
    basis: string;
    component: string;
    provider: string;
    amount: string;
  }> = [];

  if (calculation.agreementFeeAmount) {
    rows.push({
      basis: `${calculation.agreementFeePercentage ?? "—"}%`,
      component: "Agreement fee",
      provider: "Договор",
      amount:
        formatCurrency(
          calculation.agreementFeeAmount,
          calculation.currencyCode,
        ) ?? "—",
    });
  }
  if (calculation.quoteMarkupAmount) {
    rows.push({
      basis: `${calculation.quoteMarkupPercentage ?? "—"}%`,
      component: "FX markup",
      provider: "Bedrock",
      amount:
        formatCurrency(
          calculation.quoteMarkupAmount,
          calculation.currencyCode,
        ) ?? "—",
    });
  }
  if (calculation.fixedFeeAmount) {
    rows.push({
      basis: "fixed",
      component: "Fixed fee",
      provider: "Провайдер",
      amount:
        formatCurrency(
          calculation.fixedFeeAmount,
          calculation.fixedFeeCurrencyCode,
        ) ?? "—",
    });
  }
  if (calculation.additionalExpenses) {
    rows.push({
      basis: "—",
      component: "Additional expenses",
      provider: "—",
      amount:
        formatCurrency(
          calculation.additionalExpenses,
          calculation.additionalExpensesCurrencyCode,
        ) ?? "—",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee breakdown</CardTitle>
        <CardDescription>
          Комиссии из агентского договора и провайдеров
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.component}>
                <TableCell>{row.component}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.provider}
                </TableCell>
                <TableCell className="font-mono text-[12px]">
                  {row.basis}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.amount}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t">
              <TableCell className="font-semibold">Total fee</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(
                  calculation.totalFeeAmount,
                  calculation.currencyCode,
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function QuoteSummaryCard({
  calculation,
  netMarginInBase,
}: {
  calculation: CalculationView | null;
  netMarginInBase: number | null;
}) {
  if (!calculation) return null;

  const marginTone =
    netMarginInBase == null
      ? ""
      : netMarginInBase > 0
        ? "pos"
        : netMarginInBase < 0
          ? "neg"
          : "";
  const marginText =
    netMarginInBase == null
      ? "—"
      : `${netMarginInBase > 0 ? "+" : netMarginInBase < 0 ? "−" : ""}${formatCurrency(
          Math.abs(netMarginInBase),
          calculation.baseCurrencyCode,
        )}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote</CardTitle>
        <CardDescription>
          Что видит клиент · что зарабатывает Bedrock
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="kv-grid cols-4">
          <div>
            <div className="kv-label">Customer pays</div>
            <div className="kv-value-lg">
              {formatCurrency(
                calculation.originalAmount,
                calculation.currencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Beneficiary receives</div>
            <div className="kv-value-lg">
              {formatCurrency(
                calculation.totalAmount,
                calculation.baseCurrencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Final rate</div>
            <div className="kv-value-lg">{calculation.finalRate}</div>
          </div>
          <div>
            <div className="kv-label">Net profit</div>
            <div className={`kv-value-lg ${marginTone}`}>{marginText}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              после провайдерских расходов
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidityLockCard({
  calculation,
  deviation,
  intake,
  isUpdatingStatus,
  onSendCalcPdf,
  onSendToCustomer,
  onStatusChange,
  quote,
  readOnly,
}: {
  calculation: CalculationView | null;
  deviation: DeviationInfo;
  intake: ApiDealWorkflowProjection["intake"];
  isUpdatingStatus: boolean;
  onSendCalcPdf?: () => void;
  onSendToCustomer?: () => void;
  onStatusChange: (status: DealStatus) => void;
  quote: ApiDealPricingQuote | null;
  readOnly?: boolean;
}) {
  const rateLocked = quote?.expiresAt ? formatDateTime(quote.expiresAt) : "—";
  const fundingDeadline = intake.common.requestedExecutionDate
    ? formatDateTime(intake.common.requestedExecutionDate)
    : "—";
  const canAccept =
    !!calculation &&
    (deviation.kind === "none" || deviation.kind === "within");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validity &amp; lock</CardTitle>
        <CardDescription>
          Сроки фиксации курса и фондирования
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="kv-grid cols-3">
          <div>
            <div className="kv-label">Rate locked until</div>
            <div className="kv-value">{rateLocked}</div>
          </div>
          <div>
            <div className="kv-label">Quote expires</div>
            <div className="kv-value">{rateLocked}</div>
          </div>
          <div>
            <div className="kv-label">Funding deadline</div>
            <div className="kv-value">{fundingDeadline}</div>
          </div>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSendCalcPdf}
              disabled={!onSendCalcPdf}
            >
              <Copy className="h-4 w-4" />
              Дублировать
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSendCalcPdf}
              disabled={!onSendCalcPdf}
            >
              <Download className="h-4 w-4" />
              PDF для клиента
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSendToCustomer}
              disabled={!onSendToCustomer}
            >
              <Mail className="h-4 w-4" />
              Отправить клиенту
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!canAccept || isUpdatingStatus}
              onClick={() => onStatusChange("preparing_documents")}
            >
              <Lock className="h-4 w-4" />
              К согласованию
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

// helper still exported for interpolation if needed later
export function _unusedFormat(value: string) {
  return minorToDecimalString(value, 2);
}
