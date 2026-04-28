"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";

import type {
  TreasuryInventoryPositionRow,
  TreasuryInventoryPositionsListResult,
} from "../lib/queries";

import { inventoryColumns } from "./inventory-columns";

type TreasuryInventoryTableProps = {
  promise: Promise<TreasuryInventoryPositionsListResult>;
};

export function TreasuryInventoryTable({
  promise,
}: TreasuryInventoryTableProps) {
  const router = useRouter();
  const result = React.use(promise);

  const handleRowOpen = React.useCallback(
    (row: TanstackRow<TreasuryInventoryPositionRow>) => {
      router.push(`/treasury/operations/inventory/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={Promise.resolve(result)}
      columns={inventoryColumns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      onRowClick={handleRowOpen}
      onRowDoubleClick={handleRowOpen}
    />
  );
}
