"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { CounterpartyGroupOption } from "../lib/queries";

import { getColumns, type SerializedCounterparty } from "./columns";

export interface CounterpartiesListResult {
  data: SerializedCounterparty[];
  total: number;
  limit: number;
  offset: number;
}

interface CounterpartiesTableProps {
  promise: Promise<CounterpartiesListResult>;
  groupOptionsPromise: Promise<CounterpartyGroupOption[]>;
}

export function CounterpartiesTable({
  promise,
  groupOptionsPromise,
}: CounterpartiesTableProps) {
  const router = useRouter();
  const result = React.use(promise);
  const groupOptions = React.use(groupOptionsPromise);
  const pageCount = Math.ceil(result.total / result.limit);
  const columns = React.useMemo(() => getColumns(groupOptions), [groupOptions]);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedCounterparty>) => {
      router.push(`/entities/counterparties/${row.original.id}`);
    },
    [router],
  );

  const { table } = useDataTable({
    data: result.data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: {
        customerId: false,
      },
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
