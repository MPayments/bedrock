"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { EntityTableShell } from "@/components/entities/entity-table-shell";
import {
  COUNTERPARTY_COUNTRY_OPTIONS,
  getCountryPresentation,
} from "@/features/entities/counterparties/lib/countries";
import {
  REQUISITE_KIND_FILTER_OPTIONS,
  getRequisiteKindLabel,
} from "@/features/entities/requisites-shared/lib/constants";
import { formatDate } from "@/lib/format";

import type {
  RequisiteProvidersListResult,
  SerializedRequisiteProvider,
} from "../lib/types";

const COUNTRY_FILTER_OPTIONS = COUNTERPARTY_COUNTRY_OPTIONS.map((country) => ({
  value: country.value,
  label: country.label,
}));

const columns: ColumnDef<SerializedRequisiteProvider>[] = [
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
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Вид" />
    ),
    cell: ({ row }) => getRequisiteKindLabel(row.original.kind),
    meta: {
      label: "Вид",
      variant: "multiSelect",
      options: REQUISITE_KIND_FILTER_OPTIONS,
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Страна" />
    ),
    cell: ({ row }) => {
      const presentation = getCountryPresentation(row.original.country);
      return presentation?.label ?? row.original.country ?? "—";
    },
    meta: {
      label: "Страна",
      variant: "multiSelect",
      options: COUNTRY_FILTER_OPTIONS,
      filterContentClassName: "w-72",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Обновлено" />
    ),
    cell: ({ row }) => formatDate(row.original.updatedAt),
    enableSorting: true,
  },
];

type RequisiteProvidersTableProps = {
  promise: Promise<RequisiteProvidersListResult>;
};

export function RequisiteProvidersTable({
  promise,
}: RequisiteProvidersTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedRequisiteProvider>) => {
      router.push(`/entities/requisite-providers/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "updatedAt", desc: true }],
      }}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
