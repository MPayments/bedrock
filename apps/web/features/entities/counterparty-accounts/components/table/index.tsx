"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type {
  AccountsListResult,
  CurrencyFilterOption,
  SerializedAccount,
} from "@/features/entities/counterparty-accounts/lib/types";

import { getColumns } from "./columns";

interface AccountsTableProps {
  promise: Promise<AccountsListResult>;
  currencyOptionsPromise: Promise<CurrencyFilterOption[]>;
}

export function AccountsTable({
  promise,
  currencyOptionsPromise,
}: AccountsTableProps) {
  const router = useRouter();
  const currencyOptions = React.use(currencyOptionsPromise);
  const columns = React.useMemo(
    () => getColumns(currencyOptions),
    [currencyOptions],
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedAccount>) => {
      router.push(`/entities/counterparty-accounts/${row.original.id}`);
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
