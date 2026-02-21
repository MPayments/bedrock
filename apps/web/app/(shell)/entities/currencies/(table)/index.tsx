"use client";

import * as React from "react";

import type { Currency } from "@bedrock/currencies";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";

import { columns } from "./columns";

export interface CurrenciesListResult {
  data: Currency[];
  total: number;
  limit: number;
  offset: number;
}

interface CurrenciesTableProps {
  promise: Promise<CurrenciesListResult>;
}

export function CurrenciesTable({ promise }: CurrenciesTableProps) {
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
