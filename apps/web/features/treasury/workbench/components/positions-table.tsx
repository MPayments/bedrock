"use client";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import type { TreasuryPositionTableRow } from "../lib/presentation";
import { treasuryPositionsTableColumns } from "./positions-table-columns";

type TreasuryPositionsTableProps = {
  promise: Promise<EntityListResult<TreasuryPositionTableRow>>;
};

export function TreasuryPositionsTable({
  promise,
}: TreasuryPositionsTableProps) {
  return (
    <EntityTableShell
      promise={promise}
      columns={treasuryPositionsTableColumns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
        columnVisibility: {
          query: false,
        },
      }}
    />
  );
}
