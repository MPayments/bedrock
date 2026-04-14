"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Building2, Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { DropdownMenuItem } from "@bedrock/sdk-ui/components/dropdown-menu";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableToolbar } from "@bedrock/sdk-tables-ui/components/data-table-toolbar";

import { getOrganizationColumns } from "@bedrock/sdk-organizations-ui/components/organization-columns";
import { OrganizationRowActions } from "@bedrock/sdk-organizations-ui/components/organization-row-actions";
import type { OrganizationListItem } from "@bedrock/sdk-organizations-ui/lib/contracts";

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

export default function OrganizationsPage() {
  const router = useRouter();
  const [data, setData] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] =
    useState<OrganizationListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/organizations`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const response = await res.json();
        const rawItems = Array.isArray(response)
          ? response
          : (response.data ?? []);

        const items = rawItems as OrganizationListItem[];
        setData(items);
      } catch (err) {
        console.error("Organizations fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Ошибка загрузки данных",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!organizationToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(
        `${API_BASE_URL}/organizations/${organizationToDelete.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!res.ok) {
        throw new Error("Ошибка удаления организации");
      }

      setData((prev) =>
        prev.filter((org) => org.id !== organizationToDelete.id),
      );
      setDeleteDialogOpen(false);
      setOrganizationToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(
    () =>
      getOrganizationColumns({
        renderActions: (org) => (
          <OrganizationRowActions
            organization={org}
            viewLink={<Link href={`/admin/organizations/${org.id}`} />}
            extraItems={
              <DropdownMenuItem
                variant="destructive"
                disabled={deleting}
                onClick={() => {
                  setOrganizationToDelete(org);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 size={16} />
                Удалить
              </DropdownMenuItem>
            }
          />
        ),
      }),
    [deleting],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Юрлица</h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              Управление юридическими лицами.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          onClick={() => router.push("/admin/organizations/new")}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      </div>

      <div className="bg-background h-px w-full" />

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
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
            router.push(`/admin/organizations/${row.original.id}`)
          }
          contextMenuItems={(row) => [
            {
              label: "Открыть",
              onClick: () =>
                router.push(`/admin/organizations/${row.original.id}`),
            },
          ]}
        >
          <DataTableToolbar table={table} />
        </DataTable>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить юрлицо?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить организацию &quot;
              {organizationToDelete?.shortName}&quot;? Это действие можно
              отменить.
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
