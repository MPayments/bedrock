"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import { columns, type SerializedProvider } from "./columns";

export type ProvidersListResult = EntityListResult<SerializedProvider>;

interface ProvidersTableProps {
  promise: Promise<ProvidersListResult>;
}

export function ProvidersTable({ promise }: ProvidersTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedProvider>) => {
      router.push(`/entities/counterparty-account-providers/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
