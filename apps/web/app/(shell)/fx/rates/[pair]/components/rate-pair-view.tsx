"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@bedrock/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/ui/components/tabs";
import { Skeleton } from "@bedrock/ui/components/skeleton";

import { formatDate } from "@/lib/format";
import {
  computeDecimalRate,
  currencySymbol,
  formatChange,
  formatChangePercent,
  formatRate,
  formatShortDate,
  sourceLabel,
} from "@/features/fx/rates/lib/format";
import type {
  SerializedRateHistoryPoint,
  SerializedRatePair,
  SerializedSourceRate,
} from "@/features/fx/rates/lib/queries";

import type { ChartDataPoint, TimeRangeKey } from "./rate-chart";

const RateChart = dynamic(
  () => import("./rate-chart").then((m) => m.RateChart),
  { ssr: false, loading: () => <Skeleton className="h-[350px] rounded-md" /> },
);

type RatePairViewProps = {
  pair: SerializedRatePair;
  history: SerializedRateHistoryPoint[];
  timeRange: TimeRangeKey;
};

export function RatePairView({ pair, history, timeRange }: RatePairViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    for (const point of history) sources.add(point.source);
    for (const rate of pair.rates) sources.add(rate.source);
    return Array.from(sources);
  }, [history, pair.rates]);

  const [activeSource, setActiveSource] = useState(
    () => availableSources[0] ?? "cbr",
  );

  const chartDataBySource = useMemo(() => {
    const map = new Map<string, ChartDataPoint[]>();
    for (const p of history) {
      let points = map.get(p.source);
      if (!points) {
        points = [];
        map.set(p.source, points);
      }
      points.push({
        date: p.asOf,
        dateLabel: formatShortDate(p.asOf),
        rate: computeDecimalRate(p.rateNum, p.rateDen),
      });
    }
    return map;
  }, [history]);

  const currentRateBySource = useMemo(() => {
    const map = new Map<string, SerializedSourceRate>();
    for (const rate of pair.rates) {
      map.set(rate.source, rate);
    }
    return map;
  }, [pair.rates]);

  const activeChartData = chartDataBySource.get(activeSource) ?? [];

  const activeCurrentRate = currentRateBySource.get(activeSource);

  function handleTimeRangeChange(range: TimeRangeKey) {
    const params = new URLSearchParams();
    if (range !== "ALL") params.set("range", range);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={activeSource}
        onValueChange={setActiveSource}
        className="block p-1"
      >
        <TabsList className="gap-2">
          {availableSources.map((source) => (
            <TabsTrigger key={source} value={source}>
              {sourceLabel(source)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeCurrentRate ? (
        <RateCurrentSummary
          rate={activeCurrentRate}
          baseCurrencyCode={pair.baseCurrencyCode}
          quoteCurrencyCode={pair.quoteCurrencyCode}
        />
      ) : null}
      <RateChart
        data={activeChartData}
        source={activeSource}
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
      />
    </div>
  );
}

function RateCurrentSummary({
  rate,
  baseCurrencyCode,
  quoteCurrencyCode,
}: {
  rate: SerializedSourceRate;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
}) {
  const change = formatChange(rate.change);
  const changePercent = formatChangePercent(rate.changePercent);
  const formattedRate = formatRate(rate.rateNum, rate.rateDen);
  const baseCurrencySymbol = currencySymbol(baseCurrencyCode);
  const quoteCurrencySymbol = currencySymbol(quoteCurrencyCode);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardDescription>Текущий курс</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-bold font-mono tabular-nums">
            <span>1</span> <span>{baseCurrencySymbol}</span> ={" "}
            <span>{formattedRate}</span> <span>{quoteCurrencySymbol}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardDescription>Изменение</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-center">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${change.className}`}
            >
              {change.text}
            </span>
            <Badge
              variant={
                rate.changePercent !== null && rate.changePercent > 0
                  ? "default"
                  : rate.changePercent !== null && rate.changePercent < 0
                    ? "destructive"
                    : "secondary"
              }
              className="text-xs font-mono tabular-nums"
            >
              {changePercent.text}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardDescription>Дата обновления</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatDate(rate.asOf)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
