"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { Customer } from "@bedrock/customers/validation";
import { Button } from "@bedrock/ui/components/button";
import { Eye } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";

export type SerializedCustomer = Omit<Customer, "createdAt"> & {
  createdAt: string;
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
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            nativeButton={false}
            render={<Link href={`/entities/customers/${row.original.id}`} />}
            aria-label={`Открыть клиента ${row.original.displayName}`}
          >
            <Eye size={16} />
          </Button>
        </div>
      ),
      size: 40,
    },
  ];
}
