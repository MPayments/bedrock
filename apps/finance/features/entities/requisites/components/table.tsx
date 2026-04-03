"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { EntityTableShell } from "@/components/entities/entity-table-shell";
import { formatDate } from "@/lib/format";

import type {
  RequisitesFilterOptions,
  RequisitesListResult,
} from "../lib/types";
import {
  REQUISITE_KIND_FILTER_OPTIONS,
  REQUISITE_OWNER_TYPE_FILTER_OPTIONS,
  type SerializedRequisite,
} from "../../requisites-shared/lib/constants";

function getColumns(
  filterOptions: RequisitesFilterOptions,
): ColumnDef<SerializedRequisite>[] {
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
    },
    {
      accessorKey: "ownerType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Владелец" />
      ),
      cell: ({ row }) => row.original.ownerDisplay,
      meta: {
        label: "Владелец",
        variant: "select",
        options: REQUISITE_OWNER_TYPE_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "providerId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Провайдер" />
      ),
      cell: ({ row }) => row.original.providerDisplay,
      meta: {
        label: "Провайдер",
        variant: "multiSelect",
        options: filterOptions.providerOptions,
        filterContentClassName: "w-72",
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Вид" />
      ),
      cell: ({ row }) => row.original.kindDisplay,
      meta: {
        label: "Вид",
        variant: "multiSelect",
        options: REQUISITE_KIND_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      accessorKey: "currencyId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюта" />
      ),
      cell: ({ row }) => row.original.currencyDisplay,
      meta: {
        label: "Валюта",
        variant: "multiSelect",
        options: filterOptions.currencyOptions,
        filterContentClassName: "w-72",
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "identity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Идентификатор" />
      ),
      cell: ({ row }) => row.original.identity || "—",
      enableSorting: false,
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
}

type RequisitesTableProps = {
  promise: Promise<RequisitesListResult>;
  filterOptions: RequisitesFilterOptions;
};

export function RequisitesTable({
  promise,
  filterOptions,
}: RequisitesTableProps) {
  const router = useRouter();
  const columns = React.useMemo(() => getColumns(filterOptions), [filterOptions]);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedRequisite>) => {
      router.push(`/entities/requisites/${row.original.id}`);
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
