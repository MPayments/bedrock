"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@/components/entities/entity-table-shell";
import type { SerializedRequisite } from "@/features/entities/requisites-shared/lib/constants";

import type {
  CounterpartyRequisitesListResult,
  CurrencyFilterOption,
} from "../../lib/types";
import { getColumns } from "./columns";

type CounterpartyRequisitesTableProps = {
  promise: Promise<CounterpartyRequisitesListResult>;
  currencyOptionsPromise: Promise<CurrencyFilterOption[]>;
};

export function CounterpartyRequisitesTable({
  promise,
  currencyOptionsPromise,
}: CounterpartyRequisitesTableProps) {
  const router = useRouter();
  const currencyOptions = React.use(currencyOptionsPromise);
  const columns = React.useMemo(
    () => getColumns(currencyOptions),
    [currencyOptions],
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedRequisite>) => {
      router.push(`/entities/counterparty-requisites/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "updatedAt", desc: true }],
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
