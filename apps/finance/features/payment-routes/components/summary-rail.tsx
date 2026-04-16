"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

import { formatCurrencyMinorAmount } from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import { getLegKindLabel } from "./editor-shared";

type PaymentRouteSummaryRailProps = {
  calculation: PaymentRouteCalculation | null;
  options: PaymentRouteConstructorOptions;
};

function getCurrency(options: PaymentRouteConstructorOptions, currencyId: string) {
  return options.currencies.find((currency) => currency.id === currencyId) ?? null;
}

export function PaymentRouteSummaryRail({
  calculation,
  options,
}: PaymentRouteSummaryRailProps) {
  const feeTotalItems = calculation?.feeTotals ?? [];

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Сводка маршрута</CardTitle>
          {calculation ? (
            <div className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(calculation.computedAt))}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {calculation ? (
          <>
            <div className="space-y-3">
              {calculation.legs.map((leg) => {
                const fromCurrency = getCurrency(options, leg.fromCurrencyId);
                const toCurrency = getCurrency(options, leg.toCurrencyId);

                return (
                  <div key={leg.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Шаг {leg.idx}. {getLegKindLabel(leg.kind)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fromCurrency?.code} to {toCurrency?.code}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">На входе</span>
                        <span>
                          {formatCurrencyMinorAmount(leg.inputAmountMinor, fromCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">До комиссий</span>
                        <span>
                          {formatCurrencyMinorAmount(leg.grossOutputMinor, toCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">После комиссий</span>
                        <span className="font-medium">
                          {formatCurrencyMinorAmount(leg.netOutputMinor, toCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Доп. расходы</div>
              {calculation.additionalFees.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Дополнительные комиссии не добавлены.
                </div>
              ) : (
                calculation.additionalFees.map((fee) => (
                  <div key={fee.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{fee.label ?? "Комиссия"}</span>
                    <span>
                      {formatCurrencyMinorAmount(
                        fee.amountMinor,
                        getCurrency(options, fee.currencyId),
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Итого комиссий</div>
              {feeTotalItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Комиссий нет.</div>
              ) : (
                feeTotalItems.map((feeTotal) => (
                  <div
                    key={feeTotal.currencyId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {getCurrency(options, feeTotal.currencyId)?.code ?? feeTotal.currencyId}
                    </span>
                    <span>
                      {formatCurrencyMinorAmount(
                        feeTotal.amountMinor,
                        getCurrency(options, feeTotal.currencyId),
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Separator />
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">К списанию</span>
                <span className="font-medium">
                  {formatCurrencyMinorAmount(
                    calculation.amountInMinor,
                    getCurrency(options, calculation.currencyInId),
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">К получению</span>
                <span className="font-semibold text-emerald-900">
                  {formatCurrencyMinorAmount(
                    calculation.netAmountOutMinor,
                    getCurrency(options, calculation.currencyOutId),
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            После первого расчета здесь появятся breakdown по шагам, комиссии и итоговые суммы.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

