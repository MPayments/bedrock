"use client";

import { useEffect, useMemo, useState } from "react";
import {
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Download, Filter, Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableFacetedMultiFilter } from "@bedrock/sdk-tables-ui/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@bedrock/sdk-tables-ui/components/data-table-view-options";

import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { AgentCombobox } from "@/components/dashboard/AgentCombobox";
import { DataTableTextFilter } from "@bedrock/sdk-tables-ui/components/data-table-text-filter";

import {
  DealStatus,
  useDealsTable,
} from "@/lib/hooks/useDealsTable";
import { API_BASE_URL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/currency";
import {
  createDealsColumns,
  getDefaultColumnVisibility,
  CURRENCY_OPTIONS,
} from "@/components/dashboard/dealsColumns";
import { NewDealDialog } from "./_components/new-deal-dialog";

type CrmBoardProjection = {
  counts: {
    active: number;
    documents: number;
    drafts: number;
    execution_blocked: number;
    pricing: number;
  };
};

type SegValue =
  | "all"
  | "pricing"
  | "calculating"
  | "approval"
  | "funding"
  | "settled";

const SEG_TO_STATUSES: Record<SegValue, DealStatus[] | null> = {
  all: null,
  pricing: ["draft"],
  calculating: ["submitted"],
  approval: ["preparing_documents"],
  funding: ["awaiting_funds", "awaiting_payment", "closing_documents"],
  settled: ["done", "rejected", "cancelled"],
};

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "pos" | "warn";
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${tone ? ` ${tone}` : ""}`}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: SegValue;
  onChange: (v: SegValue) => void;
  options: { value: SegValue; label: string; count?: number }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented-item${value === o.value ? " active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {typeof o.count === "number" ? (
            <span className="segmented-count">{o.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [board, setBoard] = useState<CrmBoardProjection | null>(null);
  const [segStatus, setSegStatus] = useState<SegValue>("all");

  // Используем хук для управления состоянием таблицы
  const {
    data,
    loading,
    error,
    totalPages,
    statistics,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    pagination,
    setPagination,
    selectedClientId,
    setSelectedClientId,
    selectedAgentId,
    setSelectedAgentId,
    refetch,
  } = useDealsTable({
    initialPageSize: 20,
  });

  // Используем переиспользуемые колонки
  const columns = useMemo(() => createDealsColumns(), []);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    getDefaultColumnVisibility(isAdmin),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      try {
        const response = await fetch(`${API_BASE_URL}/deals/crm-board`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setBoard(null);
          }

          if (response.status === 400 || response.status === 404) {
            console.warn(
              "CRM board projection unavailable; continuing without board cards",
              { status: response.status },
            );
            return;
          }

          throw new Error(`Не удалось загрузить CRM-доску: ${response.status}`);
        }

        const payload = (await response.json()) as CrmBoardProjection;
        if (!cancelled) {
          setBoard(payload);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("CRM deal board load error:", error);
        }
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, []);

  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages,
    state: {
      sorting,
      columnFilters,
      pagination,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  // Sync segmented control → status column filter
  useEffect(() => {
    const statusCol = table.getColumn("status");
    if (!statusCol) return;
    const mapped = SEG_TO_STATUSES[segStatus];
    statusCol.setFilterValue(mapped ?? undefined);
  }, [segStatus, table]);

  const totalAmountDisplay = statistics.baseCurrencyCode
    ? formatCurrency(
        statistics.totalAmountInBase,
        statistics.baseCurrencyCode,
      )
    : "—";

  return (
    <div className="space-y-5">
      {/* 1. Page head */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
            Сделки
          </h1>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Pipeline · {statistics.totalCount} сделок · {totalAmountDisplay}{" "}
            итого
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Download /> Экспорт
          </Button>
          <Button variant="outline" size="sm">
            <Filter /> Фильтры
          </Button>
          <Button
            size="sm"
            data-testid="crm-new-deal-button"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus /> Новая сделка
          </Button>
        </div>
      </div>

      {/* 2. KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="АКТИВНЫЕ"
          value={board?.counts.active ?? statistics.activeCount}
          sub="сделок"
        />
        <Kpi
          label="БЛОКЕРЫ"
          value={board?.counts.execution_blocked ?? 0}
          sub="требуют внимания"
        />
        <Kpi
          label="ОБЪЁМ"
          value={totalAmountDisplay}
          sub={statistics.baseCurrencyCode ?? "смешанные валюты"}
        />
        <Kpi
          label="ЗАВЕРШЕНО"
          value={statistics.doneCount}
          sub="сделок"
        />
      </div>

      {/* 3. Table card */}
      <div className="deals-table overflow-hidden rounded-lg border bg-card">
        {error && (
          <div className="border-b bg-red-50 px-4 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Toolbar row 1: segmented status + view options */}
        <div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
          <Segmented
            value={segStatus}
            onChange={setSegStatus}
            options={[
              { value: "all", label: "Все", count: statistics.totalCount },
              {
                value: "pricing",
                label: "Прайсинг",
                count: board?.counts.drafts,
              },
              {
                value: "calculating",
                label: "Расчёт",
                count: board?.counts.pricing,
              },
              {
                value: "approval",
                label: "Согласование",
                count: board?.counts.documents,
              },
              {
                value: "funding",
                label: "Исполнение",
                count: board?.counts.active,
              },
              {
                value: "settled",
                label: "Завершены",
                count: statistics.doneCount,
              },
            ]}
          />
          <DataTableViewOptions table={table} />
        </div>

        {/* Toolbar row 2: filters */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3.5 py-2.5">
          <ClientCombobox
            value={selectedClientId}
            onValueChange={setSelectedClientId}
            placeholder="Выбрать клиента..."
            className="w-[250px]"
          />
          {isAdmin && (
            <AgentCombobox
              value={selectedAgentId}
              onValueChange={setSelectedAgentId}
              placeholder="Выбрать агента..."
              className="w-[250px]"
            />
          )}
          <DataTableTextFilter
            column={table.getColumn("comment")}
            title="Поиск по комментарию"
          />
          <DataTableFacetedMultiFilter
            column={table.getColumn("currency")}
            title="Валюта"
            options={CURRENCY_OPTIONS}
          />
        </div>

        {/* Table body */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            </div>
          )}
          <DataTable
            table={table}
            className="dt-flat"
            onRowDoubleClick={(row) =>
              router.push(`/deals/${row.original.id}`)
            }
            contextMenuItems={(row) => [
              {
                label: "Открыть",
                onClick: () => router.push(`/deals/${row.original.id}`),
              },
            ]}
          />
        </div>
      </div>

      <NewDealDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          void (async () => {
            setIsCreateDialogOpen(false);
            refetch();
            const response = await fetch(`${API_BASE_URL}/deals/crm-board`, {
              cache: "no-store",
              credentials: "include",
            });
            if (response.ok) {
              setBoard((await response.json()) as CrmBoardProjection);
            }
          })();
        }}
      />
    </div>
  );
}
