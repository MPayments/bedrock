"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { TreasuryExceptionQueueRow } from "@bedrock/deals/contracts";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

const KIND_FILTER_OPTIONS: Array<{
  label: string;
  value: TreasuryExceptionQueueRow["kind"] | "all";
}> = [
  { label: "Все типы", value: "all" },
  { label: "Готовые шаги", value: "ready_leg" },
  { label: "Заблокированные шаги", value: "blocked_leg" },
  { label: "Неудачные инструкции", value: "failed_instruction" },
  { label: "Пре-фондирование", value: "pre_funded_awaiting_collection" },
  { label: "Внутрикомпанейский дисбаланс", value: "intercompany_imbalance" },
  { label: "Нестыковки сверки", value: "reconciliation_mismatch" },
];

const VIEW_OPTIONS = [
  { label: "Список", value: "flat" as const },
  { label: "По сделкам", value: "grouped" as const },
];

export type QueueViewMode = (typeof VIEW_OPTIONS)[number]["value"];

export interface TreasuryQueueFilterBarProps {
  rows: TreasuryExceptionQueueRow[];
  view: QueueViewMode;
}

export function TreasuryQueueFilterBar({
  rows,
  view,
}: TreasuryQueueFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currencyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.currencyCode && !seen.has(row.currencyCode)) {
        seen.set(row.currencyCode, row.currencyCode);
      }
    }
    return Array.from(seen.values()).sort();
  }, [rows]);

  const currentKind = searchParams.get("kind") ?? "all";
  const currentCurrency = searchParams.get("currencyCode") ?? "all";
  const currentDealId = searchParams.get("dealId") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleClear() {
    router.replace(pathname);
  }

  const hasActiveFilters =
    currentKind !== "all" ||
    currentCurrency !== "all" ||
    currentDealId.length > 0 ||
    view !== "flat";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Тип
        </label>
        <Select
          value={currentKind}
          onValueChange={(value) => updateParam("kind", value)}
        >
          <SelectTrigger className="h-8 w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Валюта
        </label>
        <Select
          value={currentCurrency}
          onValueChange={(value) => updateParam("currencyCode", value)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все валюты</SelectItem>
            {currencyOptions.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Вид
        </label>
        <Select
          value={view}
          onValueChange={(value) =>
            updateParam("view", value === "flat" ? null : value)
          }
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <Button
          className="ml-auto"
          size="sm"
          variant="ghost"
          onClick={handleClear}
        >
          Сбросить фильтры
        </Button>
      ) : null}
    </div>
  );
}
