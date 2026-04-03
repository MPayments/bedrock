"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import { getColumns, type SerializedUser } from "./columns";

export type UsersListResult = EntityListResult<SerializedUser>;

export function UsersTable({
  promise,
}: {
  promise: Promise<UsersListResult>;
}) {
  const router = useRouter();
  const columns = React.useMemo(() => getColumns(), []);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedUser>) => {
      router.push(`/users/${row.original.id}`);
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
