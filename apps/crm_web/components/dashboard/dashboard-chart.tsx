"use client";

import { useState, useEffect, type HTMLAttributes } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { BarChart3, FileText, TrendingUp } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

interface DealsStats {
  total: number;
  done: {
    count: number;
    totalAmount: number;
    marginality: number;
  };
  inProgress: {
    count: number;
    totalAmount: number;
  };
  totalAmount: number;
  period: string;
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

        // Преобразуем timeRange в period для API
        let period: "day" | "week" | "month" = "month";
        if (timeRange === "7d") period = "week";
        else if (timeRange === "1d") period = "day";

        const res = await fetch(
          `${API_BASE_URL}/deals/stats?period=${period}`,
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card className={cn("pt-0 flex flex-col", className)}>
      <CardHeader className="flex items-center gap-2 space-y-0 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Результаты
          </CardTitle>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
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
            {/* Закрытые сделки */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Кол-во сделок
                </span>
                <span className="text-xl font-bold">{stats.done.count}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Сумма закрытых сделок
                </span>
                <span className="text-xl font-bold">
                  {formatAmount(stats.done.totalAmount)} ₽
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Маржинальность
                </span>
                <span className="text-xl font-bold">
                  {formatAmount(stats.done.marginality)} ₽
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Вознаграждение агентов
                </span>
                <span className="text-xl font-bold">
                  {formatAmount(stats.done.marginality * 0.15)} ₽
                </span>
              </div>
            </div>

            {/* Сделки в работе */}
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Кол-во сделок в работе
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.inProgress.count}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Сумма сделок в работе
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatAmount(stats.inProgress.totalAmount)} ₽
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
