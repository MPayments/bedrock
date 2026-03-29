"use client";

import type { HTMLAttributes } from "react";
import { Card, CardTitle, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface Application {
  id: number;
  client: string;
  amount: number;
  currency: string;
  createdAt: string;
  comment?: string;
}

export function DashboardApplications({
  className,
}: HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadApplications() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE_URL}/applications/recent?period=month`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        if (!res.ok) throw new Error("Failed to fetch applications");

        const data = await res.json();

        if (!isCancelled) {
          setApplications(data || []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Applications error:", err);
          setError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadApplications();
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

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Заявки
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
            Загрузка...
          </div>
        )}
        {error && !isLoading && (
          <div className="p-4 text-sm text-center text-red-500">{error}</div>
        )}
        {!isLoading && !error && applications.length === 0 && (
          <div className="p-4 text-sm text-center text-muted-foreground">
            Нет заявок
          </div>
        )}
        {!isLoading &&
          !error &&
          applications.map((app) => (
            <div
              key={app.id}
              onClick={() => router.push(`/applications/${app.id}`)}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0 cursor-pointer"
            >
              <div className="flex w-full items-center gap-2">
                <span>Заявка #{app.id}</span>
                <span className="ml-auto text-xs">
                  {formatDate(app.createdAt)}
                </span>
              </div>
              <div className="">
                <span className="font-medium">Клиент:</span> {app.client}
              </div>
              <div>
                <span className="font-medium">Сумма:</span>{" "}
                {formatAmount(app.amount)} {app.currency}
              </div>
              {app.comment && <div className="text-sm">{app.comment}</div>}
            </div>
          ))}
      </div>
    </Card>
  );
}
