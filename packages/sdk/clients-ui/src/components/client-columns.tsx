"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";

import { formatDateRu } from "@bedrock/sdk-clients-ui/lib/format-date";
import type { ClientListItem } from "@bedrock/sdk-clients-ui/lib/contracts";

type GetClientColumnsOptions = {
  renderActions?: (client: ClientListItem) => ReactNode;
  formatDate?: (value: string) => string;
};

export function getClientColumns(
  options?: GetClientColumnsOptions,
): ColumnDef<ClientListItem>[] {
  const fmt = options?.formatDate ?? formatDateRu;

  const columns: ColumnDef<ClientListItem>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Название" />
      ),
      meta: {
        label: "Название",
        variant: "text",
        placeholder: "Поиск по названию...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "externalRef",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="External Ref" />
      ),
      cell: ({ row }) => row.getValue("externalRef") || "\u2014",
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата создания" />
      ),
      cell: ({ row }) => fmt(row.getValue("createdAt")),
      enableSorting: true,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата обновления" />
      ),
      cell: ({ row }) => fmt(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
      enableColumnFilter: false,
    },
  ];

  if (options?.renderActions) {
    const renderActions = options.renderActions;
    columns.push({
      id: "actions",
      cell: ({ row }) => renderActions(row.original),
      size: 48,
    });
  }

  return columns;
}
