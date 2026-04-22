"use client";

import { AlertCircle, ShieldCheck, WalletCards } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import {
  formatOperationalPositionIssue,
  getDealOperationalPositionStateLabel,
  getDealOperationalPositionStateVariant,
  getFinancePrimaryOperationalPositionLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

type Position = FinanceDealWorkbench["operationalState"]["positions"][number];

export interface ExecutionReadinessSectionProps {
  blockedPositions: Position[];
  visiblePositions: Position[];
}

export function ExecutionReadinessSection({
  blockedPositions,
  visiblePositions,
}: ExecutionReadinessSectionProps) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-2 border-b p-4">
        <ShieldCheck className="text-muted-foreground h-4 w-4" />
        <div className="text-sm font-semibold">Операционная готовность</div>
      </header>

      <div className="flex flex-col gap-5 p-4">
        {blockedPositions.length > 0 ? (
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              <AlertCircle className="h-3.5 w-3.5" />
              Что мешает продолжить
            </div>
            <div className="flex flex-col gap-2">
              {blockedPositions.map((position) => (
                <div
                  key={position.kind}
                  className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/20"
                >
                  {formatOperationalPositionIssue({
                    kind: position.kind,
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground bg-muted/40 rounded-md px-3 py-2 text-sm">
            Критичных операционных блокеров сейчас нет.
          </div>
        )}

        {visiblePositions.length > 0 ? (
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              <WalletCards className="h-3.5 w-3.5" />
              Ключевые шаги движения средств
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {visiblePositions.map((position) => (
                <div
                  key={position.kind}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm"
                >
                  <span className="font-medium">
                    {getFinancePrimaryOperationalPositionLabel(position.kind)}
                  </span>
                  <Badge
                    variant={getDealOperationalPositionStateVariant(
                      position.state,
                    )}
                  >
                    {getDealOperationalPositionStateLabel(position.state)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
