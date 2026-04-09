"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import { formatDate } from "@/lib/format";

import { SOURCE_LABELS } from "../lib/constants";
import type { SerializedSourceStatus } from "../lib/queries";
import { FxSourceAvatar } from "./fx-source-avatar";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ok: "default",
  idle: "secondary",
  error: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  idle: "Ожидание",
  error: "Ошибка",
};

type RateSourcesPanelProps = {
  initialSources: SerializedSourceStatus[];
};

export function RateSourcesPanel({ initialSources }: RateSourcesPanelProps) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState<string | null>(null);

  async function handleSync(source: SerializedSourceStatus["source"]) {
    setSyncing(source);
    try {
      const result = await executeMutation({
        request: () =>
          apiClient.v1.treasury.rates.sources[":source"].sync.$post({
            param: { source },
            query: { force: true },
          }),
        fallbackMessage: `Не удалось синхронизировать ${SOURCE_LABELS[source]}`,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`${SOURCE_LABELS[source]} синхронизирован`);
      router.refresh();
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {initialSources.map((source) => (
        <Card key={source.source} className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <FxSourceAvatar source={source.source} />
              <CardTitle className="truncate text-sm font-medium">
                {SOURCE_LABELS[source.source] ?? source.source}
              </CardTitle>
            </div>
            <Badge variant={STATUS_VARIANT[source.lastStatus] ?? "secondary"}>
              {STATUS_LABEL[source.lastStatus] ?? source.lastStatus}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Синхронизация</p>
                <p>{source.lastSyncedAt ? formatDate(source.lastSyncedAt) : "Никогда"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Публикация</p>
                <p>{source.lastPublishedAt ? formatDate(source.lastPublishedAt) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">TTL</p>
                <p>{source.ttlSeconds} сек.</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Статус</p>
                <Badge variant={source.isExpired ? "destructive" : "success"} className="mt-0.5">
                  {source.isExpired ? "Истёк" : "Актуален"}
                </Badge>
              </div>
            </div>

            {source.lastError && (
              <p className="text-destructive text-xs truncate" title={source.lastError}>
                {source.lastError}
              </p>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={syncing !== null}
              onClick={() => handleSync(source.source)}
            >
              {syncing === source.source ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Синхронизировать
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
