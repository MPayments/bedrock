"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Building2,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
  ChevronLeft,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { API_BASE_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface OrganizationRow {
  id: number;
  name: string;
  orgType: string | null;
  country: string | null;
  city: string | null;
  inn: string | null;
  directorName: string | null;
  isActive: boolean;
  hasFiles: boolean;
  banksCount: number;
  createdAt: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [data, setData] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Состояние для диалога удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] =
    useState<OrganizationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Загрузка данных
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
        const items: OrganizationRow[] = Array.isArray(response)
          ? response
          : response.data ?? [];
        setData(items);
      } catch (err) {
        console.error("Organizations fetch error:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Удаление организации
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

      // Обновляем список
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

  const columns = useMemo<ColumnDef<OrganizationRow, unknown>[]>(
    () => [
      {
        id: "rowNumber",
        meta: { label: "№" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="№" align="left" />
        ),
        enableSorting: false,
        cell: ({ row }) => row.index + 1,
        size: 50,
      },
      {
        accessorKey: "name",
        meta: { label: "Название" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Название" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[300px]">
            <div className="font-medium truncate" title={row.original.name}>
              {row.original.name}
            </div>
            {row.original.orgType && (
              <div className="text-xs text-muted-foreground">
                {row.original.orgType}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "inn",
        meta: { label: "ИНН" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ИНН" />
        ),
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "city",
        meta: { label: "Город" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Город" />
        ),
        cell: ({ row }) => {
          const { country, city } = row.original;
          if (city && country) return `${city}, ${country}`;
          return city || country || "—";
        },
      },
      {
        accessorKey: "directorName",
        meta: { label: "Директор" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Директор" />
        ),
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "banksCount",
        meta: { label: "Банки" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Банки" />
        ),
        cell: ({ getValue }) => (
          <Badge variant="secondary">{getValue<number>()}</Badge>
        ),
      },
      {
        accessorKey: "hasFiles",
        meta: { label: "Файлы" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Печать/Подпись" />
        ),
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          ),
      },
      {
        id: "actions",
        meta: { label: "Действия" },
        header: () => <div className="text-right">Действия</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setOrganizationToDelete(row.original);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>{" "}
          <h1 className="text-2xl font-bold">Юрлица</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Всего:{" "}
            <span className="font-bold text-foreground">{data.length}</span>
          </div>
          <Button onClick={() => router.push("/admin/organizations/new")}>
            <Plus className="mr-2 h-4 w-4" /> Добавить юрлицо
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {/* Поиск */}
          <div className="flex items-center gap-2">
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, ИНН..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Таблица */}
          <div className="relative rounded-md border">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                              header.getContext(),
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        router.push(`/admin/organizations/${row.original.id}`)
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
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
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить юрлицо?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить организацию &quot;
              {organizationToDelete?.name}&quot;? Это действие можно отменить.
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
