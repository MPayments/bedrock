"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
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
  const router = useRouter();
  const result = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<Currency>) => {
      router.push(`/entities/currencies/${row.original.id}`);
    },
    [router],
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
    <DataTable table={table} onRowDoubleClick={handleRowDoubleClick}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
