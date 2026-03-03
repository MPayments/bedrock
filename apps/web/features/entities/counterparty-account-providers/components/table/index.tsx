"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type {
  ProvidersListResult,
  SerializedProvider,
} from "@/features/entities/counterparty-account-providers/lib/types";

import { columns } from "./columns";

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
