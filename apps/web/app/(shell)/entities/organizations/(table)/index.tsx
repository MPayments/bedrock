"use client";

import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";

import { columns, type SerializedOrganization } from "./columns";

interface OrganizationsTableProps {
  data: SerializedOrganization[];
}

export function OrganizationsTable({ data }: OrganizationsTableProps) {
  const { table } = useDataTable({
    data,
    columns,
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
