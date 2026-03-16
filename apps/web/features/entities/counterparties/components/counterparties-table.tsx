"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type {
  CounterpartiesListResult,
  SerializedCounterparty,
} from "@/features/entities/counterparties/lib/types";
import type { CounterpartyGroupOption } from "../lib/queries";

import { getColumns } from "./columns";

type CounterpartiesTableBaseProps = {
  promise: Promise<CounterpartiesListResult>;
  groupOptionsPromise: Promise<CounterpartyGroupOption[]>;
  groupFilterOptionsPromise: Promise<CounterpartyGroupOption[]>;
  detailsBasePath: string;
  lockedGroupFilterIds?: string[];
};

function CounterpartiesTableBase({
  promise,
  groupOptionsPromise,
  groupFilterOptionsPromise,
  detailsBasePath,
  lockedGroupFilterIds,
}: CounterpartiesTableBaseProps) {
  const router = useRouter();
  const groupOptions = React.use(groupOptionsPromise);
  const groupFilterOptions = React.use(groupFilterOptionsPromise);
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
      router.push(`${detailsBasePath.replace(/\/+$/, "")}/${row.original.id}`);
    },
    [detailsBasePath, router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
        columnVisibility: {
          customerId: false,
        },
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}

interface EntityCounterpartiesTableProps {
  promise: Promise<CounterpartiesListResult>;
  groupOptionsPromise: Promise<CounterpartyGroupOption[]>;
  groupFilterOptionsPromise?: Promise<CounterpartyGroupOption[]>;
  lockedGroupFilterIds?: string[];
  detailsBasePath?: string;
}

export function CounterpartiesTable({
  promise,
  groupOptionsPromise,
  groupFilterOptionsPromise,
  lockedGroupFilterIds,
  detailsBasePath = "/entities/counterparties",
}: EntityCounterpartiesTableProps) {
  return (
    <CounterpartiesTableBase
      promise={promise}
      groupOptionsPromise={groupOptionsPromise}
      groupFilterOptionsPromise={groupFilterOptionsPromise ?? groupOptionsPromise}
      lockedGroupFilterIds={lockedGroupFilterIds}
      detailsBasePath={detailsBasePath}
    />
  );
}
