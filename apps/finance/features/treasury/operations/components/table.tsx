"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@/components/entities/entity-table-shell";

import type { TreasuryOperationsListResult } from "../lib/queries";
import type { TreasuryOperationWorkspaceItem } from "@bedrock/treasury/contracts";

import { columns } from "./columns";
import { TreasuryOperationsViewSwitcher } from "./view-switcher";

type TreasuryOperationsTableProps = {
  promise: Promise<TreasuryOperationsListResult>;
};

export function TreasuryOperationsTable({
  promise,
}: TreasuryOperationsTableProps) {
  const router = useRouter();
  const result = React.use(promise);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<TreasuryOperationWorkspaceItem>) => {
      router.push(`/treasury/operations/${row.original.id}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      <TreasuryOperationsViewSwitcher viewCounts={result.viewCounts} />
      <EntityTableShell
        promise={Promise.resolve(result)}
        columns={columns}
        getRowId={(row) => row.id}
        initialState={{
          sorting: [{ id: "createdAt", desc: true }],
        }}
        onRowDoubleClick={handleRowDoubleClick}
      />
    </div>
  );
}
