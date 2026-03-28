"use client";

import * as React from "react";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import type {
  ExecutionInstructionListItem,
  TreasuryOperationListItem,
} from "../lib/queries";
import type { TreasuryExceptionTableRow } from "../lib/presentation";
import { getTreasuryUnmatchedRecordsTableColumns } from "./unmatched-records-table-columns";

type TreasuryUnmatchedRecordsTableProps = {
  assetLabels: Record<string, string>;
  instructions: ExecutionInstructionListItem[];
  operations: TreasuryOperationListItem[];
  promise: Promise<EntityListResult<TreasuryExceptionTableRow>>;
};

export function TreasuryUnmatchedRecordsTable({
  assetLabels,
  instructions,
  operations,
  promise,
}: TreasuryUnmatchedRecordsTableProps) {
  const columns = React.useMemo(
    () =>
      getTreasuryUnmatchedRecordsTableColumns({
        assetLabels,
        instructions,
        operations,
      }),
    [assetLabels, instructions, operations],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "receivedAt", desc: true }],
        columnVisibility: {
          query: false,
        },
      }}
    />
  );
}
