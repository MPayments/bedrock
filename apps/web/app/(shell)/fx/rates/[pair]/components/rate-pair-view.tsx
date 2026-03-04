"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@bedrock/ui/components/chart";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@bedrock/ui/components/tabs";

import { formatDate } from "@/lib/format";

import { SOURCE_LABELS } from "../../lib/constants";
import type {
  SerializedRateHistoryPoint,
  SerializedRatePair,
  SerializedSourceRate,
} from "../../lib/queries";

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function computeDecimalRate(rateNum: string, rateDen: string): number {
  return Number(rateNum) / Number(rateDen);
}

function formatRate(rateNum: string, rateDen: string): string {
  return computeDecimalRate(rateNum, rateDen).toFixed(6);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatChange(value: number | null): {
  text: string;
  className: string;
} {
  if (value === null) return { text: "—", className: "text-muted-foreground" };
  if (value > 0)
    return { text: `+${value.toFixed(4)}`, className: "text-green-600" };
  if (value < 0)
    return { text: value.toFixed(4), className: "text-red-600" };
  return { text: "0.0000", className: "text-muted-foreground" };
}

function formatChangePercent(value: number | null): {
  text: string;
  className: string;
} {
  if (value === null) return { text: "—", className: "text-muted-foreground" };
  if (value > 0)
    return { text: `+${value.toFixed(2)}%`, className: "text-green-600" };
  if (value < 0)
    return { text: `${value.toFixed(2)}%`, className: "text-red-600" };
  return { text: "0.00%", className: "text-muted-foreground" };
}

type ChartDataPoint = {
  date: string;
  dateLabel: string;
  rate: number;
};

const SOURCE_COLORS: Record<string, string> = {
  cbr: "hsl(220, 70%, 50%)",
  investing: "hsl(160, 60%, 45%)",
  xe: "hsl(280, 65%, 55%)",
  manual: "hsl(30, 80%, 55%)",
};

type RatePairViewProps = {
  pair: SerializedRatePair;
  history: SerializedRateHistoryPoint[];
};

export function RatePairView({ pair, history }: RatePairViewProps) {
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
    for (const source of availableSources) {
      const points = history
        .filter((p) => p.source === source)
        .map((p) => ({
          date: p.asOf,
          dateLabel: formatShortDate(p.asOf),
          rate: computeDecimalRate(p.rateNum, p.rateDen),
        }));
      map.set(source, points);
    }
    return map;
  }, [history, availableSources]);

  const currentRateBySource = useMemo(() => {
    const map = new Map<string, SerializedSourceRate>();
    for (const rate of pair.rates) {
      map.set(rate.source, rate);
    }
    return map;
  }, [pair.rates]);

  const activeChartData = chartDataBySource.get(activeSource) ?? [];
  const activeCurrentRate = currentRateBySource.get(activeSource);

  const chartConfig: ChartConfig = {
    rate: {
      label: "Курс",
      color: SOURCE_COLORS[activeSource] ?? "hsl(220, 70%, 50%)",
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={activeSource}
        onValueChange={setActiveSource}
        className="w-full p-1 block"
      >
        <TabsList className="gap-2">
          {availableSources.map((source) => (
            <TabsTrigger key={source} value={source}>
              {sourceLabel(source)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeCurrentRate && <RateCurrentSummary rate={activeCurrentRate} />}
      <RateChart
        data={activeChartData}
        config={chartConfig}
        source={activeSource}
      />
    </div>
  );
}

function RateCurrentSummary({ rate }: { rate: SerializedSourceRate }) {
  const change = formatChange(rate.change);
  const changePercent = formatChangePercent(rate.changePercent);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardDescription>Текущий курс</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {formatRate(rate.rateNum, rate.rateDen)}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <CardDescription>Изменение</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
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
              className="text-xs"
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

function RateChart({
  data,
  config,
  source,
}: {
  data: ChartDataPoint[];
  config: ChartConfig;
  source: string;
}) {
  if (data.length === 0) {
    return (
      <Card className="rounded-sm">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">
            Нет исторических данных для источника{" "}
            <span className="font-medium">{sourceLabel(source)}</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>История курса</CardTitle>
        <CardDescription>
          Источник: {sourceLabel(source)} &middot; {data.length} точек
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[350px] w-full">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as
                      | ChartDataPoint
                      | undefined;
                    if (!point) return "";
                    return formatDate(point.date);
                  }}
                  formatter={(value) => {
                    const num = value as number;
                    return (
                      <span className="font-mono tabular-nums">
                        {num.toFixed(6)}
                      </span>
                    );
                  }}
                />
              }
            />
            <Line
              dataKey="rate"
              type="monotone"
              stroke="var(--color-rate)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
