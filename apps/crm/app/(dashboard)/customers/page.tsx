"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Plus, Download, Loader2, Handshake, Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { DropdownMenuItem } from "@bedrock/sdk-ui/components/dropdown-menu";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableToolbar } from "@bedrock/sdk-tables-ui/components/data-table-toolbar";

import { getClientColumns } from "@bedrock/sdk-clients-ui/components/client-columns";
import { ClientRowActions } from "@bedrock/sdk-clients-ui/components/client-row-actions";
import type { ClientListItem } from "@bedrock/sdk-clients-ui/lib/contracts";

import { API_BASE_URL } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClientsResponse {
  data: ClientListItem[];
  total: number;
  limit: number;
  offset: number;
}

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
  const [data, setData] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const lastRequestKey = useRef<string | null>(null);

  const nameFilter =
    (columnFilters.find((f) => f.id === "name")?.value as string) ?? "";
  const debouncedNameFilter = useDebouncedValue(nameFilter, 400);

  useEffect(() => {
    const requestKey = JSON.stringify({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      query: debouncedNameFilter,
    });

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
          String(pagination.pageIndex * pagination.pageSize),
        );
        params.set("limit", String(pagination.pageSize));

        if (debouncedNameFilter) {
          params.set("name", debouncedNameFilter);
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
        setError(
          err instanceof Error ? err.message : "Ошибка загрузки данных",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pagination.pageIndex, pagination.pageSize, debouncedNameFilter]);

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

  const handleDelete = useCallback(async () => {
    if (!clientToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(
        `${API_BASE_URL}/customers/${clientToDelete.id}`,
        { method: "DELETE", credentials: "include" },
      );

      if (!res.ok) {
        throw new Error("Ошибка удаления клиента");
      }

      setData((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setTotalItems((prev) => prev - 1);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }, [clientToDelete]);

  const openDeleteDialog = useCallback((client: ClientListItem) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getClientColumns({
        renderActions: (client) => (
          <ClientRowActions
            client={client}
            viewLink={<Link href={`/customers/${client.id}`} />}
            extraItems={
              <DropdownMenuItem
                variant="destructive"
                disabled={deleting}
                onClick={() => openDeleteDialog(client)}
              >
                <Trash2 size={16} />
                Удалить
              </DropdownMenuItem>
            }
          />
        ),
      }),
    [deleting, openDeleteDialog],
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
      columnVisibility: { externalRef: false },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Handshake className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Клиенты</h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              Управление клиентами и связанной контрагентской привязкой.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportXlsx}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden md:block">XLSX</span>
          </Button>
          <Button size="lg" onClick={() => router.push("/customers/new")}>
            <Plus className="h-4 w-4" />
            <span className="hidden md:block">Добавить</span>
          </Button>
        </div>
      </div>

      <div className="bg-background h-px w-full" />

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="text-muted-foreground text-sm">Загрузка...</div>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
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
            {
              label: "Удалить",
              icon: <Trash2 className="text-destructive" />,
              onClick: () => openDeleteDialog(row.original),
            },
          ]}
        >
          <DataTableToolbar table={table} />
        </DataTable>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить клиента &quot;
              {clientToDelete?.name}&quot;? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
