"use client";

import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";

import { getColumns, type SerializedCounterparty } from "./columns";

export interface CounterpartiesListResult {
  data: SerializedCounterparty[];
  total: number;
  limit: number;
  offset: number;
}

interface CounterpartiesTableProps {
  promise: Promise<CounterpartiesListResult>;
}

export function CounterpartiesTable({ promise }: CounterpartiesTableProps) {
  const result = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);
  const columns = React.useMemo(() => getColumns(), []);

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
