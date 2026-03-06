"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@bedrock/ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import { UserRowActions } from "./user-row-actions";

export type SerializedUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  updatedAt: string;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "Админ";
  return "Пользователь";
}

export function getColumns(): ColumnDef<SerializedUser>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Имя" />
      ),
      meta: {
        label: "Имя",
        variant: "text",
        placeholder: "Поиск по имени...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Email" />
      ),
      meta: {
        label: "Email",
        variant: "text",
        placeholder: "Поиск по email...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Роль" />
      ),
      cell: ({ row }) => {
        const role = row.getValue<string | null>("role");
        return (
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {roleLabel(role)}
          </Badge>
        );
      },
      meta: {
        label: "Роль",
        variant: "multiSelect",
        options: [
          { value: "admin", label: "Админ" },
          { value: "user", label: "Пользователь" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "banned",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Статус" />
      ),
      cell: ({ row }) => {
        const banned = row.getValue<boolean | null>("banned");
        return banned ? (
          <Badge variant="destructive">Заблокирован</Badge>
        ) : (
          <Badge variant="outline">Активен</Badge>
        );
      },
      meta: {
        label: "Статус",
        variant: "select",
        options: [
          { value: "true", label: "Заблокирован" },
          { value: "false", label: "Активен" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата создания" />
      ),
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "actions",
      cell: ({ row }) => <UserRowActions user={row.original} />,
      size: 48,
    },
  ];
}
