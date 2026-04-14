"use client";

import * as React from "react";
import type { ColumnDef, Row as TanstackRow, TableState } from "@tanstack/react-table";

import { DataTable, type ContextMenuItem } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableToolbar } from "@bedrock/sdk-tables-ui/components/data-table-toolbar";
import { useDataTable } from "@bedrock/sdk-tables-ui/hooks/use-data-table";
import type { ExtendedColumnSort } from "@bedrock/sdk-tables-ui/lib/types";

export interface EntityListResult<TData> {
  data: TData[];
  total: number;
  limit: number;
  offset: number;
}

type EntityTableInitialState<TData> = Omit<Partial<TableState>, "sorting"> & {
  sorting?: ExtendedColumnSort<TData>[];
};

type EntityTableShellProps<TData> = {
  promise: Promise<EntityListResult<TData>>;
  columns: ColumnDef<TData>[];
  getRowId: (row: TData) => string;
  initialState?: EntityTableInitialState<TData>;
  onRowDoubleClick?: (row: TanstackRow<TData>) => void;
  contextMenuItems?: ContextMenuItem<TData>[] | ((row: TanstackRow<TData>) => ContextMenuItem<TData>[]);
  clearOnDefault?: boolean;
};

export function EntityTableShell<TData>({
  promise,
  columns,
  getRowId,
  initialState,
  onRowDoubleClick,
  contextMenuItems,
  clearOnDefault = true,
}: EntityTableShellProps<TData>) {
  const result = React.use(promise);
  const pageCount = Math.ceil(result.total / result.limit);

  const { table } = useDataTable({
    data: result.data,
    columns,
    pageCount,
    initialState,
    getRowId,
    clearOnDefault,
  });

  return (
    <DataTable
      table={table}
      onRowDoubleClick={
        onRowDoubleClick
          ? (row) => {
              onRowDoubleClick(row);
            }
          : undefined
      }
      contextMenuItems={contextMenuItems}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
