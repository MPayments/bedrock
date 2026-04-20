"use client";

import Link from "next/link";

import { AlertTriangle, ExternalLink } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import {
  derivePaymentRouteLegSemantics,
  formatPaymentRouteLegSemantics,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
} from "@bedrock/treasury/contracts";

import {
  getPaymentRouteChargedFeeTotals,
  getPaymentRouteInternalFeeTotals,
} from "../lib/cost-summary";
import { formatCurrencyMinorAmount } from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteRequisiteWarning } from "../lib/requisites";

type PaymentRouteSummaryRailProps = {
  calculation: PaymentRouteCalculation | null;
  className?: string;
  draft: PaymentRouteDraft;
  options: PaymentRouteConstructorOptions;
  sticky?: boolean;
  warnings?: PaymentRouteRequisiteWarning[];
};

function getCurrency(options: PaymentRouteConstructorOptions, currencyId: string) {
  return options.currencies.find((currency) => currency.id === currencyId) ?? null;
}

export function PaymentRouteSummaryRail({
  calculation,
  className,
  draft,
  options,
  sticky = true,
  warnings = [],
}: PaymentRouteSummaryRailProps) {
  const chargedFeeTotals = getPaymentRouteChargedFeeTotals(calculation);
  const internalFeeTotals = getPaymentRouteInternalFeeTotals(calculation);

  return (
    <Card className={cn(sticky ? "xl:sticky xl:top-6" : null, className)}>
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
        {warnings.length > 0 ? (
          <>
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
            <Separator />
          </>
        ) : null}
        {calculation ? (
          <>
            <div className="space-y-3">
              {calculation.legs.map((leg) => {
                const fromCurrency = getCurrency(options, leg.fromCurrencyId);
                const toCurrency = getCurrency(options, leg.toCurrencyId);
                const semanticsLabel = formatPaymentRouteLegSemantics(
                  derivePaymentRouteLegSemantics({
                    draft,
                    legIndex: leg.idx - 1,
                  }),
                );

                return (
                  <div key={leg.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Шаг {leg.idx}. {semanticsLabel}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fromCurrency?.code} → {toCurrency?.code}
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
                        <span className="text-muted-foreground">До комиссий шага</span>
                        <span>
                          {formatCurrencyMinorAmount(leg.grossOutputMinor, toCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">После комиссий шага</span>
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
              <div className="space-y-1">
                <div className="text-sm font-medium">В цене клиента</div>
                <div className="text-sm text-muted-foreground">
                  Эти расходы либо уменьшают сумму к получению, либо оплачиваются клиентом отдельно.
                </div>
              </div>
              {chargedFeeTotals.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Расходы не включены в клиентскую цену.
                </div>
              ) : (
                chargedFeeTotals.map((feeTotal) => (
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
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Доплаты маршрута</div>
                <div className="text-sm text-muted-foreground">
                  Каждая доплата может быть включена в цену клиента или учтена только в себестоимости.
                </div>
              </div>
              {calculation.additionalFees.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Отдельные доплаты не добавлены.
                </div>
              ) : (
                calculation.additionalFees.map((fee) => (
                  <div key={fee.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {fee.label ?? "Доп. расход"}
                        </span>
                        <Badge variant="outline">
                          {fee.chargeToCustomer
                            ? "В цене клиента"
                            : "Только себестоимость"}
                        </Badge>
                      </div>
                      <span>
                        {formatCurrencyMinorAmount(
                          fee.amountMinor,
                          getCurrency(options, fee.currencyId),
                        )}
                      </span>
                    </div>
                    {fee.currencyId !== fee.outputImpactCurrencyId ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Справочно в валюте получения:{" "}
                        {formatCurrencyMinorAmount(
                          fee.outputImpactMinor,
                          getCurrency(options, fee.outputImpactCurrencyId),
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Только в себестоимости</div>
                <div className="text-sm text-muted-foreground">
                  Эти расходы учитываются во внутренней экономике маршрута, но не меняют цену для клиента.
                </div>
              </div>
              {internalFeeTotals.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Внутренних расходов нет.
                </div>
              ) : (
                internalFeeTotals.map((feeTotal) => (
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
                <span className="text-muted-foreground">Бенефициар получит</span>
                <span className="font-semibold text-emerald-900">
                  {formatCurrencyMinorAmount(
                    calculation.amountOutMinor,
                    getCurrency(options, calculation.currencyOutId),
                  )}
                </span>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Клиент оплатит</span>
                <span className="font-semibold text-amber-950">
                  {formatCurrencyMinorAmount(
                    calculation.clientTotalInMinor,
                    getCurrency(options, calculation.currencyInId),
                  )}
                </span>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Себестоимость маршрута</span>
                <span className="font-semibold text-sky-950">
                  {formatCurrencyMinorAmount(
                    calculation.costPriceInMinor,
                    getCurrency(options, calculation.currencyInId),
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Чистый результат по FX</span>
                <span className="font-medium text-sky-950">
                  {formatCurrencyMinorAmount(
                    calculation.cleanAmountOutMinor,
                    getCurrency(options, calculation.currencyOutId),
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            После первого расчета здесь появится разбивка по шагам, комиссии и итоговые суммы.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
