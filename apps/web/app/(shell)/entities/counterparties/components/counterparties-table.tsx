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
  groupFilterOptionsPromise?: Promise<CounterpartyGroupOption[]>;
  detailsBasePath?: string;
  lockedGroupFilterIds?: string[];
}

function toFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

export function CounterpartiesTable({
  promise,
  groupOptionsPromise,
  groupFilterOptionsPromise,
  detailsBasePath = "/entities/counterparties",
  lockedGroupFilterIds,
}: CounterpartiesTableProps) {
  const router = useRouter();
  const result = React.use(promise);
  const groupOptions = React.use(groupOptionsPromise);
  const groupFilterOptions = React.use(
    groupFilterOptionsPromise ?? groupOptionsPromise,
  );
  const pageCount = Math.ceil(result.total / result.limit);
  const allowedGroupFilterIdSet = React.useMemo(
    () => new Set(groupFilterOptions.map((group) => group.id)),
    [groupFilterOptions],
  );
  const columns = React.useMemo(
    () =>
      getColumns(groupOptions, {
        detailsBasePath,
        groupFilterOptions,
        lockedGroupFilterIds,
      }),
    [detailsBasePath, groupFilterOptions, groupOptions, lockedGroupFilterIds],
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedCounterparty>) => {
      router.push(`${detailsBasePath}/${row.original.id}`);
    },
    [detailsBasePath, router],
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
  React.useEffect(() => {
    const lockedValues = lockedGroupFilterIds ?? [];

    if (allowedGroupFilterIdSet.size === 0 && lockedValues.length === 0) {
      return;
    }

    const groupColumn = table.getColumn("groupIds");
    if (!groupColumn) {
      return;
    }

    const currentValues = toFilterValues(groupColumn.getFilterValue());
    const filteredValues = currentValues.filter((value) =>
      allowedGroupFilterIdSet.has(value),
    );
    const currentSet = new Set(filteredValues);
    let changed = filteredValues.length !== currentValues.length;

    for (const lockedGroupId of lockedValues) {
      if (!currentSet.has(lockedGroupId)) {
        currentSet.add(lockedGroupId);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    groupColumn.setFilterValue(Array.from(currentSet));
  }, [allowedGroupFilterIdSet, lockedGroupFilterIds, table]);

  return (
    <DataTable table={table} onRowDoubleClick={handleRowDoubleClick}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
