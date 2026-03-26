"use client";

import type { HTMLAttributes } from "react";
import { Card, CardTitle, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Inbox, Loader2 } from "lucide-react";

interface UnassignedApplication {
  id: number;
  client: string;
  clientId: number;
  requestedAmount: string | null;
  requestedCurrency: string | null;
  createdAt: string;
  comment?: string;
  status: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  RUB: "₽",
  CNY: "¥",
  TRY: "₺",
  AED: "د.إ",
};

export function DashboardInbox({ className }: HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const [applications, setApplications] = useState<UnassignedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takingId, setTakingId] = useState<number | null>(null);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL}/applications/unassigned?limit=10`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Failed to fetch applications");

      const data = await res.json();
      setApplications(data || []);
    } catch (err) {
      console.error("Inbox error:", err);
      setError("Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleTakeApplication = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTakingId(id);
      const res = await fetch(`${API_BASE_URL}/applications/${id}/take`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Не удалось взять заявку");
      }

      // Remove from list and navigate to application
      setApplications((prev) => prev.filter((app) => app.id !== id));
      router.push(`/applications/${id}`);
    } catch (err) {
      console.error("Take application error:", err);
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setTakingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const formatAmount = (amount: string | null, currency: string | null) => {
    if (!amount || !currency) return null;
    const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
    try {
      const formatted = new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(parseFloat(amount));
      return `${formatted} ${symbol}`;
    } catch {
      return `${amount} ${symbol}`;
    }
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          Входящие заявки
          {applications.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {applications.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && (
          <div className="p-4 text-sm text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        )}
        {error && !isLoading && (
          <div className="p-4 text-sm text-center text-red-500">{error}</div>
        )}
        {!isLoading && !error && applications.length === 0 && (
          <div className="p-4 text-sm text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Нет новых заявок
          </div>
        )}
        {!isLoading &&
          !error &&
          applications.map((app) => (
            <div
              key={app.id}
              onClick={() => router.push(`/applications/${app.id}`)}
              className="border-b p-4 text-sm leading-tight last:border-b-0 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
            >
              <div className="flex w-full items-center gap-2 mb-2">
                <span className="font-medium">Заявка #{app.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(app.createdAt)}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-muted-foreground">Клиент:</span>{" "}
                <span className="font-medium">{app.client}</span>
              </div>
              {app.requestedAmount && app.requestedCurrency && (
                <div className="mb-2">
                  <span className="text-muted-foreground">Запрос:</span>{" "}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatAmount(app.requestedAmount, app.requestedCurrency)}
                  </span>
                </div>
              )}
              {app.comment && (
                <div className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {app.comment}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-900/20"
                onClick={(e) => handleTakeApplication(app.id, e)}
                disabled={takingId === app.id}
              >
                {takingId === app.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Взятие...
                  </>
                ) : (
                  "Взять заявку"
                )}
              </Button>
            </div>
          ))}
      </div>
    </Card>
  );
}
