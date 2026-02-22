"use client";

import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { Option } from "@/types/data-table";

import { getColumns, type SerializedOrganization } from "./columns";

export interface OrganizationsListResult {
  data: SerializedOrganization[];
  total: number;
  limit: number;
  offset: number;
}

interface OrganizationsTableProps {
  promise: Promise<[OrganizationsListResult, Option[]]>;
}

export function OrganizationsTable({ promise }: OrganizationsTableProps) {
  const [result, currencyOptions] = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);
  const columns = React.useMemo(
    () => getColumns(currencyOptions),
    [currencyOptions],
  );

  const { table } = useDataTable({
    data: result.data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
    getRowId: (row) => row.id,
    clearOnDefault: true,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
