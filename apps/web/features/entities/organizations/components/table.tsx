"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { EntityTableShell } from "@/components/entities/entity-table-shell";
import { formatDate } from "@/lib/format";

import type {
  OrganizationsListResult,
  SerializedOrganization,
} from "../lib/types";

const KIND_LABELS: Record<SerializedOrganization["kind"], string> = {
  legal_entity: "Юридическое лицо",
  individual: "Физическое лицо",
};

const columns: ColumnDef<SerializedOrganization>[] = [
  {
    accessorKey: "shortName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Краткое имя" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "fullName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Полное имя" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Тип" />
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

type OrganizationsTableProps = {
  promise: Promise<OrganizationsListResult>;
};

export function OrganizationsTable({ promise }: OrganizationsTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedOrganization>) => {
      router.push(`/entities/organizations/${row.original.id}`);
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
