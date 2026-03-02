"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import type { Currency } from "@bedrock/platform/currencies/contracts";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";

import { columns } from "./columns";

export type CurrenciesListResult = EntityListResult<Currency>;

interface CurrenciesTableProps {
  promise: Promise<CurrenciesListResult>;
}

export function CurrenciesTable({ promise }: CurrenciesTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<Currency>) => {
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
