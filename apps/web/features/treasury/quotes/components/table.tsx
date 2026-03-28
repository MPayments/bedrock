"use client";

import { useRouter } from "next/navigation";

import {
  type EntityListResult,
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type { FxQuoteListRow } from "@/features/treasury/quotes/lib/presentation";
import { buildTreasuryQuoteDetailsHref } from "@/features/treasury/quotes/lib/routes";

import { columns } from "./columns";

interface FxQuotesTableProps {
  promise: Promise<EntityListResult<FxQuoteListRow>>;
}

export function FxQuotesTable({ promise }: FxQuotesTableProps) {
  const router = useRouter();

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        columnVisibility: {
          status: false,
        },
        sorting: [{ id: "createdAt", desc: true }],
      }}
      getRowId={(row: FxQuoteListRow) => row.id}
      onRowDoubleClick={(row) => {
        router.push(buildTreasuryQuoteDetailsHref(row.original.id));
      }}
    />
  );
}
