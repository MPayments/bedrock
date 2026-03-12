"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@bedrock/ui/components/button";
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

import { formatDate } from "@/lib/format";
import {
  getDecimalPlaces,
  sourceLabel,
} from "@/features/fx/rates/lib/format";

export type ChartDataPoint = {
  date: string;
  dateLabel: string;
  rate: number;
};

export const TIME_RANGES = [
  { key: "1D", label: "День", days: 1 },
  { key: "1W", label: "Неделя", days: 7 },
  { key: "1M", label: "Месяц", days: 30 },
  { key: "6M", label: "Полгода", days: 180 },
  { key: "1Y", label: "Год", days: 365 },
  { key: "ALL", label: "Все", days: null },
] as const;

export type TimeRangeKey = (typeof TIME_RANGES)[number]["key"];

const CHART_CONFIG: ChartConfig = {
  rate: {
    label: "Курс",
  },
};

const CHART_NUMBER_TICK_PROPS = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  fontSize: 12,
};

export function RateChart({
  data,
  source,
  timeRange,
  onTimeRangeChange,
}: {
  data: ChartDataPoint[];
  source: string;
  timeRange: TimeRangeKey;
  onTimeRangeChange: (range: TimeRangeKey) => void;
}) {
  const tickDecimals = useMemo(() => {
    if (data.length === 0) return 2;
    const rates = data.map((d) => d.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const range = max - min;
    const ref = range > 0 ? range : min;
    return getDecimalPlaces(ref, 2);
  }, [data]);

  const yAxisWidth = Math.max(60, (tickDecimals + 2) * 8 + 12);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>История курса</CardTitle>
            <CardDescription>
              Источник: {sourceLabel(source)} &middot; {data.length} точек
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <Button
                key={r.key}
                variant={timeRange === r.key ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => onTimeRangeChange(r.key)}
              >
                {r.key}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="h-[350px] w-full">
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
              width={yAxisWidth}
              tick={CHART_NUMBER_TICK_PROPS}
              tickFormatter={(v: number) => v.toFixed(tickDecimals)}
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
              stroke="var(--color-primary)"
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
