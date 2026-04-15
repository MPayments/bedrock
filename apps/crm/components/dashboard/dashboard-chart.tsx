"use client";

import { useState, useEffect, type HTMLAttributes } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

interface DealsStats {
  totalCount: number;
  byStatus: Record<string, number>;
}

export function DashboardChart({ className }: HTMLAttributes<HTMLDivElement>) {
  const [timeRange, setTimeRange] = useState("30d");
  const [stats, setStats] = useState<DealsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadStats() {
      try {
        setIsLoading(true);
        setError(null);

        const now = new Date();
        const from = new Date(now);
        if (timeRange === "1d") from.setDate(from.getDate() - 1);
        else if (timeRange === "7d") from.setDate(from.getDate() - 7);
        else from.setMonth(from.getMonth() - 1);

        const params = new URLSearchParams({
          dateFrom: from.toISOString().slice(0, 10),
          dateTo: now.toISOString().slice(0, 10),
        });

        const res = await fetch(
          `${API_BASE_URL}/deals/stats?${params}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

        if (!res.ok) throw new Error("Failed to fetch stats");

        const data = await res.json();

        if (!isCancelled) {
          setStats(data);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Stats error:", err);
          setError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadStats();
    return () => {
      isCancelled = true;
    };
  }, [timeRange]);

  return (
    <Card className={cn("pt-0 flex flex-col", className)}>
      <CardHeader className="flex items-center gap-2 space-y-0 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Результаты
          </CardTitle>
        </div>

        <Select
          value={timeRange}
          onValueChange={(value) => setTimeRange(value ?? "30d")}
        >
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="30d" className="rounded-lg">
              За месяц
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              За неделю
            </SelectItem>
            <SelectItem value="1d" className="rounded-lg">
              За день
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 z-10">
          <div
            className="flex rounded-lg border"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-6 flex-1 min-h-0 overflow-auto">
        {isLoading && (
          <div className="py-8 text-center text-muted-foreground">
            Загрузка...
          </div>
        )}
        {error && !isLoading && (
          <div className="py-8 text-center text-red-500">{error}</div>
        )}
        {!isLoading && !error && stats && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Всего сделок
                </span>
                <span className="text-xl font-bold">{stats.totalCount}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Закрытые
                </span>
                <span className="text-xl font-bold">{stats.byStatus["closed"] ?? 0}</span>
              </div>
            </div>

            {/* Сделки в работе */}
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  В работе
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.byStatus["in_progress"] ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Новые
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.byStatus["new"] ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
