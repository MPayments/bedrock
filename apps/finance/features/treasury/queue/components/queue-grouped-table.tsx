"use client";

import Link from "next/link";

import type { TreasuryExceptionQueueRow } from "@bedrock/deals/contracts";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { useQueueRowActions } from "../lib/use-queue-row-actions";
import {
  formatQueueRowAge,
  formatQueueRowAmount,
  formatQueueRowKindLabel,
  getQueueRowKindVariant,
} from "./queue-table";
import { TreasuryQueueRowActions } from "./queue-row-actions";

interface DealGroup {
  dealId: string | null;
  dealRef: string | null;
  rows: TreasuryExceptionQueueRow[];
  latestTriggeredAt: Date;
}

function groupRowsByDeal(
  rows: TreasuryExceptionQueueRow[],
): DealGroup[] {
  const byDealId = new Map<string, DealGroup>();
  const unassigned: TreasuryExceptionQueueRow[] = [];
  let unassignedLatest: Date | null = null;

  for (const row of rows) {
    if (!row.dealId) {
      unassigned.push(row);
      const triggered = new Date(row.triggeredAt);
      if (!unassignedLatest || triggered > unassignedLatest) {
        unassignedLatest = triggered;
      }
      continue;
    }
    const key = row.dealId;
    const existing = byDealId.get(key);
    const triggered = new Date(row.triggeredAt);
    if (existing) {
      existing.rows.push(row);
      if (triggered > existing.latestTriggeredAt) {
        existing.latestTriggeredAt = triggered;
      }
    } else {
      byDealId.set(key, {
        dealId: row.dealId,
        dealRef: row.dealRef,
        latestTriggeredAt: triggered,
        rows: [row],
      });
    }
  }

  const groups = Array.from(byDealId.values());
  if (unassigned.length > 0 && unassignedLatest) {
    groups.push({
      dealId: null,
      dealRef: null,
      latestTriggeredAt: unassignedLatest,
      rows: unassigned,
    });
  }

  return groups.sort(
    (left, right) =>
      right.latestTriggeredAt.getTime() - left.latestTriggeredAt.getTime(),
  );
}

export interface TreasuryExceptionQueueGroupedProps {
  rows: TreasuryExceptionQueueRow[];
}

export function TreasuryExceptionQueueGrouped({
  rows,
}: TreasuryExceptionQueueGroupedProps) {
  const { actions, state } = useQueueRowActions();

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Очередь пуста — нет исключений, требующих внимания.
      </div>
    );
  }

  const groups = groupRowsByDeal(rows);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const title = group.dealId
          ? (group.dealRef ?? group.dealId.slice(0, 8))
          : "Без сделки";
        return (
          <Card
            key={group.dealId ?? "__unassigned__"}
            data-testid={`treasury-queue-group-${group.dealId ?? "unassigned"}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
              <CardTitle className="text-base">
                {group.dealId ? (
                  <Link
                    className="text-primary hover:underline"
                    href={`/treasury/deals/${group.dealId}`}
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </CardTitle>
              <Badge variant="outline">
                {group.rows.length} {group.rows.length === 1 ? "запись" : "записи"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {group.rows.map((row) => {
                const key = [
                  row.kind,
                  row.dealId ?? "",
                  row.instructionId ?? "",
                  row.legIdx ?? "",
                  typeof row.metadata?.exceptionId === "string"
                    ? row.metadata.exceptionId
                    : "",
                ].join(":");
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                      <Badge variant={getQueueRowKindVariant(row.kind)}>
                        {formatQueueRowKindLabel(row.kind)}
                      </Badge>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Нога:</span>{" "}
                        {row.legIdx ?? "—"}
                      </div>
                      {row.counterpartyName ? (
                        <div className="max-w-[240px] truncate text-sm">
                          {row.counterpartyName}
                        </div>
                      ) : null}
                      <div className="text-sm tabular-nums">
                        {formatQueueRowAmount(row)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatQueueRowAge(row.ageSeconds)}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <TreasuryQueueRowActions
                        actions={actions}
                        row={row}
                        state={state}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
