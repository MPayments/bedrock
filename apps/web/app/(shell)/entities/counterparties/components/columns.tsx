"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { Counterparty } from "@bedrock/counterparties/validation";
import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import { Eye } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";

type SerializedCounterparty = Omit<Counterparty, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function kindLabel(kind: string) {
  if (kind === "individual") return "Физ. лицо";
  return "Юр. лицо";
}

export function getColumns(): ColumnDef<SerializedCounterparty>[] {
  return [
    {
      accessorKey: "shortName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Краткое имя" />
      ),
      meta: {
        label: "Краткое имя",
        variant: "text",
        placeholder: "Поиск по краткому имени...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Полное имя" />
      ),
      meta: {
        label: "Полное имя",
        variant: "text",
        placeholder: "Поиск по полному имени...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Тип" />
      ),
      cell: ({ row }) => {
        const kind = row.getValue<string>("kind");
        return <Badge variant="secondary">{kindLabel(kind)}</Badge>;
      },
      meta: {
        label: "Тип",
        variant: "multiSelect",
        options: [
          { value: "legal_entity", label: "Юр. лицо" },
          { value: "individual", label: "Физ. лицо" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Страна" />
      ),
      cell: ({ row }) => row.getValue("country") ?? "—",
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "customerId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Customer ID" />
      ),
      cell: ({ row }) => row.getValue("customerId") || "—",
      enableColumnFilter: false,
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "groups",
      accessorFn: (row) => row.groupIds.length,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Группы" />
      ),
      cell: ({ row }) => row.original.groupIds.length,
      enableColumnFilter: false,
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
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            nativeButton={false}
            render={
              <Link href={`/entities/counterparties/${row.original.id}`} />
            }
            aria-label={`Открыть контрагента ${row.original.shortName}`}
          >
            <Eye size={16} />
          </Button>
        </div>
      ),
      size: 40,
    },
  ];
}

export type { SerializedCounterparty };
