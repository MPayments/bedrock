"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Search, Download, Loader2 } from "lucide-react";

import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";

import { API_BASE_URL } from "@/lib/constants";

interface ClientRow {
  id: string;
  name: string;
  externalRef: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientsResponse {
  data: ClientRow[];
  total: number;
  limit: number;
  offset: number;
}

// Custom hook для debounce
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ClientsPage() {
  const router = useRouter();
  const [data, setData] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const [exporting, setExporting] = useState(false);
  const lastRequestKey = useRef<string | null>(null);

  // Загрузка данных с сервера
  useEffect(() => {
    // Создаём ключ запроса для дедупликации
    const requestKey = JSON.stringify({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      query: debouncedSearchQuery,
    });

    // Пропускаем, если запрос с такими же параметрами уже был
    if (lastRequestKey.current === requestKey) {
      return;
    }
    lastRequestKey.current = requestKey;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set(
          "offset",
          String(pagination.pageIndex * pagination.pageSize)
        );
        params.set("limit", String(pagination.pageSize));

        if (debouncedSearchQuery) {
          params.set("name", debouncedSearchQuery);
        }

        const url = `${API_BASE_URL}/customers?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const response: ClientsResponse = await res.json();
        setData(response.data ?? []);
        setTotalItems(response.total ?? 0);
      } catch (err) {
        console.error("Clients fetch error:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearchQuery]);

  // Экспорт в XLSX
  const handleExportXlsx = useCallback(async () => {
    try {
      setExporting(true);

      const res = await fetch(`${API_BASE_URL}/customers/export/xlsx`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка экспорта: ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      setError(err instanceof Error ? err.message : "Ошибка экспорта данных");
    } finally {
      setExporting(false);
    }
  }, []);

  const columns = useMemo<ColumnDef<ClientRow, unknown>[]>(
    () => [
      {
        id: "rowNumber",
        meta: { label: "№" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="№" />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          return (row.index + 1 + pageIndex * pageSize).toString();
        },
      },
      {
        accessorKey: "name",
        meta: { label: "Организация" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Организация" />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "externalRef",
        meta: { label: "Ref" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Ref" />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "description",
        meta: { label: "Описание" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Описание" />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Создан" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Создан" />
        ),
        enableSorting: false,
        cell: ({ getValue }) =>
          new Date(getValue<string>()).toLocaleDateString("ru-RU"),
      },
      {
        accessorKey: "updatedAt",
        meta: { label: "Обновлен" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Обновлен" />
        ),
        enableSorting: false,
        cell: ({ getValue }) =>
          new Date(getValue<string>()).toLocaleDateString("ru-RU"),
      },
    ],
    []
  );

  const totalPages = Math.ceil(totalItems / pagination.pageSize);

  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
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
          <h1 className="text-2xl font-bold">Клиенты</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Всего:{" "}
            <span className="font-bold text-foreground">{totalItems}</span>
          </div>
          <Button
            variant="outline"
            onClick={handleExportXlsx}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Выгрузить XLSX
          </Button>
          <Button onClick={() => router.push("/customers/new")}>
            <Plus className="mr-2 h-4 w-4" /> Добавить клиента
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
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
            <DataTable
              table={table}
              onRowDoubleClick={(row) =>
                router.push(`/customers/${row.original.id}`)
              }
              contextMenuItems={(row) => [
                {
                  label: "Открыть",
                  onClick: () => router.push(`/customers/${row.original.id}`),
                },
              ]}
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="relative w-[300px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по названию, ИНН, директору..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </DataTable>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
