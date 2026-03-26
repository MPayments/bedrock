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
import { ChevronLeft, Plus } from "lucide-react";

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
import { DataTableTextFilter } from "@/components/data-table/DataTableTextFilter";
import { DataTableFacetedFilter } from "@/components/data-table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { AgentCombobox } from "@/components/dashboard/AgentCombobox";
import { NewApplicationDialog } from "@/components/dashboard/NewApplicationDialog";

import { useApplicationsTable } from "@/lib/hooks/useApplicationsTable";
import {
  createApplicationsColumns,
  getDefaultColumnVisibility,
  formatCurrency,
  CURRENCY_OPTIONS,
  CALCULATION_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/dashboard/applicationsColumns";

export default function ApplicationsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin ?? false;
  const [showNewApplicationDialog, setShowNewApplicationDialog] =
    useState(false);

  // Используем переиспользуемый хук
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
  } = useApplicationsTable();

  // Используем переиспользуемые колонки
  const columns = useMemo(
    () => createApplicationsColumns({ isAdmin }),
    [isAdmin]
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    getDefaultColumnVisibility(isAdmin)
  );

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
          <h1 className="text-2xl font-bold">Заявки</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end text-sm">
            <div className="font-medium text-muted-foreground">
              Всего заявок:{" "}
              <span className="font-bold text-foreground">
                {statistics.totalCount}
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
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowNewApplicationDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Новая заявка
          </Button>
        </div>
      </div>

      {/* Диалог создания заявки */}
      <NewApplicationDialog
        open={showNewApplicationDialog}
        onOpenChange={setShowNewApplicationDialog}
        onSuccess={refetch}
      />

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
                column={table.getColumn("currency") as any}
                title="Валюта"
                options={CURRENCY_OPTIONS}
              />
              <DataTableFacetedFilter
                column={table.getColumn("hasCalculation") as any}
                title="Расчёт"
                options={CALCULATION_OPTIONS as any}
              />
              <DataTableFacetedFilter
                column={table.getColumn("status") as any}
                title="Статус"
                options={STATUS_OPTIONS as any}
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
                  table.getRowModel().rows.map((row) => {
                    const isUnassigned =
                      !row.original.agentName || row.original.agentName === "—";
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isUnassigned
                            ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-2 border-l-amber-400"
                            : ""
                        }`}
                        onClick={() =>
                          router.push(`/applications/${row.original.id}`)
                        }
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
                    );
                  })
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
