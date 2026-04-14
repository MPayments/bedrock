"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { UserStatusBadge } from "@bedrock/sdk-users-ui/components/user-status-badge";
import { createRoleLabelResolver } from "@bedrock/sdk-users-ui/lib/role-label";

import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { formatDate } from "@/lib/format";
import {
  FINANCE_USER_ROLE_DISPLAY_OPTIONS,
  FINANCE_USER_ROLE_OPTIONS,
} from "../lib/role-options";
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

const resolveRoleLabel = createRoleLabelResolver(
  FINANCE_USER_ROLE_DISPLAY_OPTIONS,
);

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
            {resolveRoleLabel(role)}
          </Badge>
        );
      },
      meta: {
        label: "Роль",
        variant: "multiSelect",
        options: FINANCE_USER_ROLE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
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
      cell: ({ row }) => (
        <UserStatusBadge banned={row.getValue<boolean | null>("banned")} />
      ),
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
