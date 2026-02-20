"use client";

import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";

import { columns, type SerializedOrganization } from "./columns";

export interface OrganizationsListResult {
  data: SerializedOrganization[];
  total: number;
  limit: number;
  offset: number;
}

interface OrganizationsTableProps {
  promise: Promise<OrganizationsListResult>;
}

export function OrganizationsTable({ promise }: OrganizationsTableProps) {
  const result = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);

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
