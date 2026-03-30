"use client";

import type { HTMLAttributes } from "react";
import { Card, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Handshake } from "lucide-react";

interface Deal {
  id: string;
  client: string;
  amount: number;
  currency: string;
  amountInBase: number;
  baseCurrencyCode: string;
  status: string;
  createdAt: string;
  comment?: string;
}

interface DealsData {
  pending: Deal[];
  inProgress: Deal[];
  done: Deal[];
}

export function DashboardDeals({ className }: HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const [deals, setDeals] = useState<DealsData>({
    pending: [],
    inProgress: [],
    done: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDeals() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/deals/by-status`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch deals");

        const data = await res.json();

        if (!isCancelled) {
          setDeals({
            pending: data.pending || [],
            inProgress: data.inProgress || [],
            done: data.done || [],
          });
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Deals error:", err);
          setError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadDeals();
    return () => {
      isCancelled = true;
    };
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const totalDeals =
    deals.pending.length + deals.inProgress.length + deals.done.length;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-muted-foreground" />
          Сделки
          {totalDeals > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {totalDeals}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <div className="flex flex-row flex-1 min-h-0">
        {/* В ожидании */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex justify-center pb-2 shrink-0">
            <Badge className="bg-gray-500">В ожидании Д/С</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Загрузка...
              </div>
            )}
            {error && !isLoading && (
              <div className="p-4 text-sm text-center text-red-500">
                {error}
              </div>
            )}
            {!isLoading && !error && deals.pending.length === 0 && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Нет сделок
              </div>
            )}
            {!isLoading &&
              !error &&
              deals.pending.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight last:border-b-0 cursor-pointer"
                >
                  <div className="flex w-full items-center gap-2">
                    <span>Сделка #{deal.id}</span>
                    <span className="ml-auto text-xs">
                      {formatDate(deal.createdAt)}
                    </span>
                  </div>
                  <div className="w-full truncate">
                    <span className="font-medium">Клиент:</span> {deal.client}
                  </div>
                  <div>
                    <span className="font-medium">Сумма:</span>{" "}
                    {formatAmount(deal.amount)} {deal.currency}
                  </div>
                  <div>
                    <span className="font-medium">Итого ({deal.baseCurrencyCode || "RUB"}):</span>{" "}
                    {formatAmount(deal.amountInBase)} {deal.baseCurrencyCode || "₽"}
                  </div>
                  {deal.comment && (
                    <div className="text-sm w-full truncate">
                      {deal.comment}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        <Separator orientation="vertical" />

        {/* В работе */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex justify-center pb-2 shrink-0">
            <Badge className="bg-yellow-500">В работе</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Загрузка...
              </div>
            )}
            {error && !isLoading && (
              <div className="p-4 text-sm text-center text-red-500">
                {error}
              </div>
            )}
            {!isLoading && !error && deals.inProgress.length === 0 && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Нет сделок
              </div>
            )}
            {!isLoading &&
              !error &&
              deals.inProgress.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight last:border-b-0 cursor-pointer"
                >
                  <div className="flex w-full items-center gap-2">
                    <span>Сделка #{deal.id}</span>
                    <span className="ml-auto text-xs">
                      {formatDate(deal.createdAt)}
                    </span>
                  </div>
                  <div className="w-full truncate">
                    <span className="font-medium">Клиент:</span> {deal.client}
                  </div>
                  <div>
                    <span className="font-medium">Сумма:</span>{" "}
                    {formatAmount(deal.amount)} {deal.currency}
                  </div>
                  <div>
                    <span className="font-medium">Итого ({deal.baseCurrencyCode || "RUB"}):</span>{" "}
                    {formatAmount(deal.amountInBase)} {deal.baseCurrencyCode || "₽"}
                  </div>
                  {deal.comment && (
                    <div className="text-sm w-full truncate">
                      {deal.comment}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        <Separator orientation="vertical" />

        {/* Закрывающие документы */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex justify-center pb-2 shrink-0">
            <Badge className="bg-green-500">Закрывающие документы</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Загрузка...
              </div>
            )}
            {error && !isLoading && (
              <div className="p-4 text-sm text-center text-red-500">
                {error}
              </div>
            )}
            {!isLoading && !error && deals.done.length === 0 && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Нет сделок
              </div>
            )}
            {!isLoading &&
              !error &&
              deals.done.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight last:border-b-0 cursor-pointer"
                >
                  <div className="flex w-full items-center gap-2">
                    <span>Сделка #{deal.id}</span>
                    <span className="ml-auto text-xs">
                      {formatDate(deal.createdAt)}
                    </span>
                  </div>
                  <div className="w-full truncate">
                    <span className="font-medium">Клиент:</span> {deal.client}
                  </div>
                  <div>
                    <span className="font-medium">Сумма:</span>{" "}
                    {formatAmount(deal.amount)} {deal.currency}
                  </div>
                  <div>
                    <span className="font-medium">Итого ({deal.baseCurrencyCode || "RUB"}):</span>{" "}
                    {formatAmount(deal.amountInBase)} {deal.baseCurrencyCode || "₽"}
                  </div>
                  {deal.comment && (
                    <div className="text-sm w-full truncate">
                      {deal.comment}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
