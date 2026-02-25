"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";

import type { AccountSchema } from "@bedrock/accounts/validation";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";

import { AccountRowActions } from "../components/account-row-actions";

type Account = z.infer<typeof AccountSchema>;

export type SerializedAccount = Omit<Account, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  currencyDisplay?: string;
};

export type CurrencyFilterOption = {
  value: string;
  label: string;
};

export function getColumns(
  currencyFilterOptions: CurrencyFilterOption[],
): ColumnDef<SerializedAccount>[] {
  return [
    {
      accessorKey: "label",
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
      accessorKey: "accountNo",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Номер счёта" />
      ),
      cell: ({ row }) => row.getValue("accountNo") || "—",
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "currencyId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюта" />
      ),
      cell: ({ row }) => row.original.currencyDisplay ?? "—",
      meta: {
        label: "Валюта",
        variant: "multiSelect",
        options: currencyFilterOptions,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "iban",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="IBAN" />
      ),
      cell: ({ row }) => row.getValue("iban") || "—",
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "stableKey",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Стабильный ключ" />
      ),
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
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата обновления" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "actions",
      cell: ({ row }) => <AccountRowActions account={row.original} />,
      size: 48,
    },
  ];
}
