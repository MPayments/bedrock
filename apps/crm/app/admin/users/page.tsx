"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
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
import { Loader2, Plus, Users } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { DataTableToolbar } from "@bedrock/sdk-tables-ui/components/data-table-toolbar";

import { UserRowActions } from "@bedrock/sdk-users-ui/components/user-row-actions";
import { UserStatusBadge } from "@bedrock/sdk-users-ui/components/user-status-badge";
import type { UserDetails } from "@bedrock/sdk-users-ui/lib/contracts";
import { createRoleLabelResolver } from "@bedrock/sdk-users-ui/lib/role-label";

import { apiClient } from "@/lib/api/browser-client";
import { CRM_USER_ROLE_DISPLAY_OPTIONS } from "./_lib/role-options";

const resolveRoleLabel = createRoleLabelResolver(CRM_USER_ROLE_DISPLAY_OPTIONS);

interface UsersListResponse {
  data: UserDetails[];
  total: number;
  limit: number;
  offset: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        const res = await apiClient.v1.users.$get({ query: {} });
        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }
        const payload = (await res.json()) as UsersListResponse;
        if (cancelled) return;
        setUsers(Array.isArray(payload.data) ? payload.data : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Users fetch error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo<ColumnDef<UserDetails, unknown>[]>(
    () => [
      {
        id: "rowNumber",
        meta: { label: "№" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="№" />
        ),
        enableSorting: false,
        cell: ({ row }) => row.index + 1,
        size: 50,
      },
      {
        accessorKey: "name",
        meta: {
          label: "Имя",
          variant: "text" as const,
          placeholder: "Поиск по имени...",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Имя" />
        ),
        enableColumnFilter: true,
        cell: ({ row }) => (
          <div
            className="max-w-[300px] font-medium truncate"
            title={row.original.name}
          >
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "email",
        meta: { label: "Email" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Email" />
        ),
        cell: ({ getValue }) => getValue<string>() || "—",
      },
      {
        accessorKey: "role",
        meta: { label: "Роль" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Роль" />
        ),
        cell: ({ row }) => {
          const role = row.original.role;
          return (
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {resolveRoleLabel(role)}
            </Badge>
          );
        },
      },
      {
        id: "status",
        meta: { label: "Статус" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Статус" />
        ),
        cell: ({ row }) => <UserStatusBadge banned={row.original.banned} />,
        enableSorting: false,
      },
      {
        id: "actions",
        meta: { label: "Действия" },
        header: () => <div className="text-right">Действия</div>,
        cell: ({ row }) => (
          <UserRowActions
            user={{ id: row.original.id, name: row.original.name }}
            viewLink={<Link href={`/admin/users/${row.original.id}`} />}
          />
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, columnFilters, columnVisibility },
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
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Пользователи</h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              Управление пользователями и ролями.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          onClick={() => router.push("/admin/users/new")}
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
        <DataTable
          table={table}
          onRowDoubleClick={(row) =>
            router.push(`/admin/users/${row.original.id}`)
          }
          contextMenuItems={(row) => [
            {
              label: "Открыть",
              onClick: () => router.push(`/admin/users/${row.original.id}`),
            },
          ]}
        >
          <DataTableToolbar table={table} />
        </DataTable>
      </div>
    </div>
  );
}
