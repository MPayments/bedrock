"use client";

import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";

import { getColumns, type SerializedCustomer } from "./columns";

export interface CustomersListResult {
  data: SerializedCustomer[];
  total: number;
  limit: number;
  offset: number;
}

interface CustomersTableProps {
  promise: Promise<CustomersListResult>;
}

export function CustomersTable({ promise }: CustomersTableProps) {
  const result = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);
  const columns = React.useMemo(() => getColumns(), []);

  const { table } = useDataTable({
    data: result.data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: {
        externalRef: false,
      },
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
