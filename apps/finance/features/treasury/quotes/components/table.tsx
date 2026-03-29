"use client";

import {
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type {
  FxQuoteListItem,
  FxQuotesListResult,
} from "@/features/treasury/quotes/lib/queries";

import { columns } from "./columns";

interface FxQuotesTableProps {
  promise: Promise<FxQuotesListResult>;
}

export function FxQuotesTable({ promise }: FxQuotesTableProps) {
  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      getRowId={(row: FxQuoteListItem) => row.id}
    />
  );
}
