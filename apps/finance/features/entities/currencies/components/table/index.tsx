"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
} from "@bedrock/sdk-tables-ui/components/entity-table-shell";
import type {
  CurrenciesListResult,
  CurrencyListItem,
} from "@/features/entities/currencies/lib/types";

import { columns } from "./columns";

interface CurrenciesTableProps {
  promise: Promise<CurrenciesListResult>;
}

export function CurrenciesTable({ promise }: CurrenciesTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<CurrencyListItem>) => {
      router.push(`/entities/currencies/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
