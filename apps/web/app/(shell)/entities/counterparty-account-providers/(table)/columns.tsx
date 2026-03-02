"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";

import type { CounterpartyAccountProviderSchema } from "@bedrock/core/counterparty-accounts/contracts";
import { Badge } from "@bedrock/ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";

import {
  PROVIDER_COUNTRY_OPTIONS,
  getCountryPresentation,
} from "../lib/countries";
import { ProviderRowActions } from "../components/provider-row-actions";

type AccountProvider = z.infer<typeof CounterpartyAccountProviderSchema>;

export type SerializedProvider = Omit<AccountProvider, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  bank: "Банк",
  exchange: "Биржа",
  blockchain: "Блокчейн",
  custodian: "Кастодиан",
};

function typeLabel(type: string) {
  return PROVIDER_TYPE_LABELS[type] ?? type;
}

const TYPE_FILTER_OPTIONS = [
  { value: "bank", label: "Банк" },
  { value: "exchange", label: "Биржа" },
  { value: "blockchain", label: "Блокчейн" },
  { value: "custodian", label: "Кастодиан" },
];

const COUNTRY_FILTER_OPTIONS = PROVIDER_COUNTRY_OPTIONS.map((c) => ({
  value: c.value,
  label: c.label,
}));

export const columns: ColumnDef<SerializedProvider>[] = [
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
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Тип" />
    ),
    cell: ({ row }) => {
      const type = row.getValue<string>("type");
      return <Badge variant="secondary">{typeLabel(type)}</Badge>;
    },
    meta: {
      label: "Тип",
      variant: "multiSelect",
      options: TYPE_FILTER_OPTIONS,
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
    cell: ({ row }) => {
      const rawCountry = row.getValue<string | null>("country");
      const presentation = getCountryPresentation(rawCountry);

      if (presentation) {
        return presentation.label;
      }

      if (typeof rawCountry === "string" && rawCountry.trim().length > 0) {
        return rawCountry.trim().toUpperCase();
      }

      return "—";
    },
    meta: {
      label: "Страна",
      variant: "multiSelect",
      options: COUNTRY_FILTER_OPTIONS,
    },
    enableColumnFilter: true,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "bic",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="БИК" />
    ),
    cell: ({ row }) => row.getValue("bic") || "—",
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "swift",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="SWIFT" />
    ),
    cell: ({ row }) => row.getValue("swift") || "—",
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
    cell: ({ row }) => <ProviderRowActions provider={row.original} />,
    size: 48,
  },
];
