import { Activity } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatMinorAmountWithCurrency } from "./format";
import type {
  ApiCrmDealWorkbenchProjection,
  ApiProfitabilityAmount,
} from "./types";

type DealProfitabilityCardProps = {
  profitabilitySnapshot: ApiCrmDealWorkbenchProjection["profitabilitySnapshot"];
  profitabilityVariance: ApiCrmDealWorkbenchProjection["profitabilityVariance"];
};

function formatProfitabilityAmounts(
  items: ApiProfitabilityAmount[] | null | undefined,
) {
  if (!items || items.length === 0) {
    return "0";
  }

  return items
    .map((item) =>
      formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode),
    )
    .join(" · ");
}

function getCoverageLabel(value: string) {
  switch (value) {
    case "complete":
      return "Факты собраны";
    case "partial":
      return "Факты частичные";
    case "not_started":
      return "Только план";
    default:
      return value;
  }
}

function getCoverageVariant(value: string) {
  switch (value) {
    case "complete":
      return "default" as const;
    case "partial":
      return "secondary" as const;
    case "not_started":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function formatFamilyLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function DealProfitabilityCard({
  profitabilitySnapshot,
  profitabilityVariance,
}: DealProfitabilityCardProps) {
  if (!profitabilitySnapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Финансовый результат
          </CardTitle>
          <CardDescription>
            Появится после привязки расчета к сделке.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Финансовый результат
            </CardTitle>
            <CardDescription>
              Плановая экономика из принятого расчета и фактическая маржа по
              execution facts.
            </CardDescription>
          </div>
          <Badge
            variant={getCoverageVariant(
              profitabilityVariance?.actualCoverage.state ?? "not_started",
            )}
          >
            {getCoverageLabel(
              profitabilityVariance?.actualCoverage.state ?? "not_started",
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Комиссионный доход
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatProfitabilityAmounts(profitabilitySnapshot.feeRevenue)}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Доход от спреда
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatProfitabilityAmounts(profitabilitySnapshot.spreadRevenue)}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Расходы провайдера
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatProfitabilityAmounts(
                profitabilitySnapshot.providerFeeExpense,
              )}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Валовый доход
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatProfitabilityAmounts(profitabilitySnapshot.totalRevenue)}
            </div>
          </div>
        </div>

        {profitabilityVariance ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ожидаемая чистая маржа
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {formatProfitabilityAmounts(
                    profitabilityVariance.expectedNetMargin,
                  )}
                </div>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Реализованная маржа
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {formatProfitabilityAmounts(
                    profitabilityVariance.realizedNetMargin,
                  )}
                </div>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Отклонение
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {formatProfitabilityAmounts(
                    profitabilityVariance.netMarginVariance,
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Variance по cost family
              </div>
              {profitabilityVariance.varianceByCostFamily.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                  Фактические расходы по семействам еще не записаны.
                </div>
              ) : (
                profitabilityVariance.varianceByCostFamily.map((item) => (
                  <div
                    key={`${item.classification}:${item.family}`}
                    className="rounded-lg border px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        {formatFamilyLabel(item.family)}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.classification}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      План:{" "}
                      <span className="font-medium text-foreground">
                        {formatProfitabilityAmounts(item.expected)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Факт:{" "}
                      <span className="font-medium text-foreground">
                        {formatProfitabilityAmounts(item.actual)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Delta:{" "}
                      <span className="font-medium text-foreground">
                        {formatProfitabilityAmounts(item.variance)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Фактическая маржа появится после materialized execution facts и
            сверки.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
