"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";
import type {
  FinanceDealListItem,
  FinanceDealsListResult,
} from "@/features/treasury/deals/lib/queries";

import { columns } from "./columns";

type FinanceDealsTableProps = {
  promise: Promise<FinanceDealsListResult>;
};

export function FinanceDealsTable({ promise }: FinanceDealsTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<FinanceDealListItem>) => {
      router.push(`/treasury/deals/${row.original.dealId}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.dealId}
      initialState={{
        columnVisibility: {
          blockerState: false,
          documentSummary: false,
          executionSummary: false,
          internalEntityName: false,
          nextAction: false,
        },
        sorting: [{ id: "createdAt", desc: true }],
      }}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
