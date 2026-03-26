"use client";

import { useMemo, useState } from "react";
import {
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DataTableFacetedFilter } from "@/components/data-table/DataTableFacetedFilter";
import { DataTableTextFilter } from "@/components/data-table/DataTableTextFilter";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { AgentCombobox } from "@/components/dashboard/AgentCombobox";

import { useDealsTable } from "@/lib/hooks/useDealsTable";
import {
  createDealsColumns,
  getDefaultColumnVisibility,
  formatCurrency,
  CURRENCY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/dashboard/dealsColumns";

export default function DealsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin ?? false;

  // Начальные фильтры: активные статусы (все кроме "done" и "cancelled")
  const initialStatusFilter = [
    "preparing_documents",
    "awaiting_funds",
    "awaiting_payment",
    "closing_documents",
  ] as const;

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
  } = useDealsTable({
    initialStatusFilter: [...initialStatusFilter],
    initialPageSize: 20,
  });

  // Используем переиспользуемые колонки
  const columns = useMemo(() => createDealsColumns({ isAdmin }), [isAdmin]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...getDefaultColumnVisibility(isAdmin),
    closedAt: true, // На странице сделок показываем дату закрытия
  });

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
                {formatCurrency(
                  statistics.totalAmountInBase,
                  statistics.baseCurrencyCode ?? "RUB"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

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
                column={table.getColumn("status") as any}
                title="Статус"
                options={STATUS_OPTIONS}
              />
              <DataTableFacetedFilter
                column={table.getColumn("currency") as any}
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
    </div>
  );
}
