"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, Loader2, Plus, Search } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";

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
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.v1.users.$get({ query: {} });
        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }
        const payload = (await res.json()) as UsersListResponse;
        if (cancelled) return;
        setUsers(Array.isArray(payload.data) ? payload.data : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
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
        meta: { label: "Имя" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Имя" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[300px] font-medium truncate" title={row.original.name}>
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
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Пользователи</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Всего:{" "}
            <span className="font-bold text-foreground">{users.length}</span>
          </div>
          <Button onClick={() => router.push("/admin/users/new")}>
            <Plus className="mr-2 h-4 w-4" /> Добавить пользователя
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <div className="flex items-center gap-2">
                <div className="relative w-[300px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени, email..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </DataTable>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
