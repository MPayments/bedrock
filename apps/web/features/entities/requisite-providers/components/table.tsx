"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { EntityTableShell } from "@/components/entities/entity-table-shell";
import { formatDate } from "@/lib/format";

import type {
  RequisiteProvidersListResult,
  SerializedRequisiteProvider,
} from "../lib/types";

const KIND_LABELS: Record<SerializedRequisiteProvider["kind"], string> = {
  bank: "Банк",
  blockchain: "Блокчейн",
  exchange: "Биржа",
  custodian: "Кастодиан",
};

const columns: ColumnDef<SerializedRequisiteProvider>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Название" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Вид" />
    ),
    cell: ({ row }) => KIND_LABELS[row.original.kind],
    enableSorting: true,
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Страна" />
    ),
    cell: ({ row }) => row.original.country ?? "—",
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
      router.push(`/entities/parties/requisite-providers/${row.original.id}`);
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
