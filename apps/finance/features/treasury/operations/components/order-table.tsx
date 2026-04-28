"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";

import type {
  TreasuryOrderRow,
  TreasuryOrdersListResult,
} from "../lib/queries";

import { orderColumns } from "./order-columns";

type TreasuryOrdersTableProps = {
  promise: Promise<TreasuryOrdersListResult>;
};

export function TreasuryOrdersTable({ promise }: TreasuryOrdersTableProps) {
  const router = useRouter();
  const result = React.use(promise);

  const handleRowOpen = React.useCallback(
    (row: TanstackRow<TreasuryOrderRow>) => {
      router.push(`/treasury/operations/orders/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={Promise.resolve(result)}
      columns={orderColumns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      onRowClick={handleRowOpen}
      onRowDoubleClick={handleRowOpen}
    />
  );
}
