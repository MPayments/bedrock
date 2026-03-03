"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import type { OperationSummaryDto } from "../lib/queries";
import { getColumns } from "./columns";

interface OperationsJournalTableProps {
  promise: Promise<EntityListResult<OperationSummaryDto>>;
}

export function OperationsJournalTable({
  promise,
}: OperationsJournalTableProps) {
  const router = useRouter();
  const columns = React.useMemo(() => getColumns(), []);

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<OperationSummaryDto>) => {
      router.push(`/operations/journal/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
        columnVisibility: {
          query: false,
          sourceId: false,
          bookId: false,
        },
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
