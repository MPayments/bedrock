"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";

import type {
  TreasuryOperationRow,
  TreasuryOperationsListResult,
} from "../lib/queries";

import { columns } from "./columns";

type TreasuryOperationsTableProps = {
  promise: Promise<TreasuryOperationsListResult>;
};

export function TreasuryOperationsTable({
  promise,
}: TreasuryOperationsTableProps) {
  const router = useRouter();
  const result = React.use(promise);

  const handleRowOpen = React.useCallback(
    (row: TanstackRow<TreasuryOperationRow>) => {
      router.push(`/treasury/operations/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={Promise.resolve(result)}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      onRowClick={handleRowOpen}
      onRowDoubleClick={handleRowOpen}
    />
  );
}
