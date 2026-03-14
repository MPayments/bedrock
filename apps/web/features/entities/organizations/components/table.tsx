"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { Badge } from "@bedrock/ui/components/badge";
import { COUNTRIES } from "@bedrock/reference-data/countries";

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

const COUNTRY_BY_ALPHA2 = new Map(
  COUNTRIES.map((country) => [country.alpha2, country]),
);

const COUNTRY_FILTER_OPTIONS = COUNTRIES.map((country) => ({
  value: country.alpha2,
  label: `${country.emoji} ${country.name}`,
})).sort((a, b) => a.label.localeCompare(b.label));

function getCountryLabel(code: string | null) {
  if (!code) {
    return "—";
  }

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return "—";
  }

  const country = COUNTRY_BY_ALPHA2.get(normalizedCode);
  if (!country) {
    return normalizedCode;
  }

  return `${country.emoji} ${country.name}`;
}

const columns: ColumnDef<SerializedOrganization>[] = [
  {
    accessorKey: "shortName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Краткое имя" />
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
    cell: ({ row }) => (
      <Badge variant="secondary">{KIND_LABELS[row.original.kind]}</Badge>
    ),
    meta: {
      label: "Тип",
      variant: "multiSelect",
      options: [
        { value: "legal_entity", label: KIND_LABELS.legal_entity },
        { value: "individual", label: KIND_LABELS.individual },
      ],
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Страна" />
    ),
    cell: ({ row }) => getCountryLabel(row.original.country),
    meta: {
      label: "Страна",
      variant: "multiSelect",
      options: COUNTRY_FILTER_OPTIONS,
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

type OrganizationsTableProps = {
  promise: Promise<OrganizationsListResult>;
  detailsBasePath?: string;
};

export function OrganizationsTable({
  promise,
  detailsBasePath = "/entities/organizations",
}: OrganizationsTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedOrganization>) => {
      router.push(`${detailsBasePath.replace(/\/+$/, "")}/${row.original.id}`);
    },
    [detailsBasePath, router],
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
