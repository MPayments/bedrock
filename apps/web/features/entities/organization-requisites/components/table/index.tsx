"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@/components/entities/entity-table-shell";
import type { SerializedRequisite } from "@/features/entities/requisites-shared/lib/constants";

import type {
  CurrencyFilterOption,
  OrganizationRequisitesListResult,
} from "../../lib/types";
import { getColumns } from "./columns";

type OrganizationRequisitesTableProps = {
  promise: Promise<OrganizationRequisitesListResult>;
  currencyOptionsPromise: Promise<CurrencyFilterOption[]>;
};

export function OrganizationRequisitesTable({
  promise,
  currencyOptionsPromise,
}: OrganizationRequisitesTableProps) {
  const router = useRouter();
  const currencyOptions = React.use(currencyOptionsPromise);
  const columns = React.useMemo(
    () => getColumns(currencyOptions),
    [currencyOptions],
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedRequisite>) => {
      router.push(`/entities/requisites/${row.original.id}`);
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
