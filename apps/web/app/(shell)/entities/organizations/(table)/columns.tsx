"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Organization } from "@bedrock/organizations";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import type { Option } from "@/types/data-table";
import { Badge } from "@bedrock/ui/components/badge";
import { formatDate } from "@/lib/format";

type SerializedOrganization = Omit<Organization, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export function getColumns(
  currencyOptions: Option[] = [],
): ColumnDef<SerializedOrganization>[] {
  return [
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
      accessorKey: "baseCurrency",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюта" />
      ),
      meta: {
        label: "Валюта",
        variant: "multiSelect",
        options: currencyOptions,
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "isTreasury",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Казначейство" />
      ),
      cell: ({ row }) => {
        const isTreasury = row.getValue<boolean>("isTreasury");
        return (
          <Badge variant={isTreasury ? "default" : "secondary"}>
            {isTreasury ? "Да" : "Нет"}
          </Badge>
        );
      },
      meta: {
        label: "Казначейство",
        variant: "select",
        options: [
          { label: "Да", value: "true" },
          { label: "Нет", value: "false" },
        ],
      },
      filterFn: (row, id, filterValue: string) => {
        if (!filterValue) return true;
        return String(row.getValue(id)) === filterValue;
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Создана" />
      ),
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Обновлена" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
      enableColumnFilter: false,
    },
  ];
}

export type { SerializedOrganization };
