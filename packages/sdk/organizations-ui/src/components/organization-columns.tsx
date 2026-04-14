"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";

import { formatDateRu } from "@bedrock/sdk-organizations-ui/lib/format-date";
import type { OrganizationListItem } from "@bedrock/sdk-organizations-ui/lib/contracts";
import { KIND_LABELS, KIND_FILTER_OPTIONS } from "@bedrock/sdk-organizations-ui/lib/kind-labels";
import { getCountryLabel, COUNTRY_FILTER_OPTIONS } from "@bedrock/sdk-organizations-ui/lib/country-labels";

type GetOrganizationColumnsOptions = {
  renderActions?: (organization: OrganizationListItem) => ReactNode;
  formatDate?: (value: string) => string;
};

export function getOrganizationColumns(
  options?: GetOrganizationColumnsOptions,
): ColumnDef<OrganizationListItem>[] {
  const fmt = options?.formatDate ?? formatDateRu;

  const columns: ColumnDef<OrganizationListItem>[] = [
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
        options: [...KIND_FILTER_OPTIONS],
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
      cell: ({ row }) => fmt(row.original.updatedAt),
      enableSorting: true,
    },
  ];

  if (options?.renderActions) {
    const renderActions = options.renderActions;
    columns.push({
      id: "actions",
      cell: ({ row }) => renderActions(row.original),
      size: 48,
    });
  }

  return columns;
}
