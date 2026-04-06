"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import {
  type Column,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";

import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { Button } from "@bedrock/sdk-ui/components/button";
import { DataTableFacetedFilter } from "@/components/data-table/DataTableFacetedFilter";
import { DataTableTextFilter } from "@/components/data-table/DataTableTextFilter";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { AgentCombobox } from "@/components/dashboard/AgentCombobox";

import { useDealsTable } from "@/lib/hooks/useDealsTable";
import { API_BASE_URL } from "@/lib/constants";
import type {
  CurrencyCode,
  DealsRow,
  DealStatus,
} from "@/lib/hooks/useDealsTable";
import {
  createDealsColumns,
  getDefaultColumnVisibility,
  formatCurrency,
  CURRENCY_OPTIONS,
  STATUS_OPTIONS,
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

export default function DealsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [board, setBoard] = useState<CrmBoardProjection | null>(null);

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

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...getDefaultColumnVisibility(isAdmin),
    closedAt: true, // На странице сделок показываем дату закрытия
  });

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

          // The board projection is additive. Older or stale API processes can
          // still serve the deals page without this route, so don't fail the page.
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

  return (
    <div className="space-y-4">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Сделки</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end text-sm">
            <div className="font-medium text-muted-foreground">
              Активных:{" "}
              <span className="font-bold text-foreground">
                {statistics.activeCount}
              </span>{" "}
              / Завершено:{" "}
              <span className="font-bold text-foreground">
                {statistics.doneCount}
              </span>
            </div>
            <div className="font-medium text-muted-foreground">
              Общая сумма:{" "}
              <span className="font-bold text-foreground">
                {statistics.baseCurrencyCode
                  ? formatCurrency(
                      statistics.totalAmountInBase,
                      statistics.baseCurrencyCode,
                    )
                  : "Смешанные валюты"}
              </span>
            </div>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Новая сделка
          </Button>
        </div>
      </div>

      {board ? (
        <div className="grid gap-3 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Черновики</div>
              <div className="mt-1 text-2xl font-semibold">{board.counts.drafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Прайсинг</div>
              <div className="mt-1 text-2xl font-semibold">{board.counts.pricing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Документы</div>
              <div className="mt-1 text-2xl font-semibold">{board.counts.documents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Активные</div>
              <div className="mt-1 text-2xl font-semibold">{board.counts.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Блокеры</div>
              <div className="mt-1 text-2xl font-semibold">
                {board.counts.execution_blocked}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
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
              <DataTableFacetedFilter
                column={
                  table.getColumn("status") as
                    | Column<DealsRow, DealStatus>
                    | undefined
                }
                title="Статус"
                options={STATUS_OPTIONS}
              />
              <DataTableFacetedFilter
                column={
                  table.getColumn("currency") as
                    | Column<DealsRow, CurrencyCode>
                    | undefined
                }
                title="Валюта"
                options={CURRENCY_OPTIONS}
              />
            </div>
            <DataTableViewOptions table={table} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <div className="text-sm text-muted-foreground">Загрузка...</div>
              </div>
            )}
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/deals/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {loading ? "Загрузка..." : "Нет данных"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} />
        </CardContent>
      </Card>

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
