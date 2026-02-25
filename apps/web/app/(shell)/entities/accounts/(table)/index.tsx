"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import { columns, type SerializedAccount } from "./columns";

export type AccountsListResult = EntityListResult<SerializedAccount>;

interface AccountsTableProps {
  promise: Promise<AccountsListResult>;
}

export function AccountsTable({ promise }: AccountsTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedAccount>) => {
      router.push(`/entities/accounts/${row.original.id}`);
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
