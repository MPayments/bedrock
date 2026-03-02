"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Customer } from "@bedrock/platform/customers/contracts";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import { CustomerRowActions } from "./customer-row-actions";

export type SerializedCustomer = Omit<Customer, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export function getColumns(): ColumnDef<SerializedCustomer>[] {
  return [
    {
      accessorKey: "displayName",
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
      cell: ({ row }) => row.getValue("externalRef") || "—",
      enableColumnFilter: true,
      enableSorting: true,
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
      enableColumnFilter: false,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата обновления" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      id: "actions",
      cell: ({ row }) => <CustomerRowActions customer={row.original} />,
      size: 48,
    },
  ];
}
