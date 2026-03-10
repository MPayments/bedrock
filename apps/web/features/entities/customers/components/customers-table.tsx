"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import {
  EntityTableShell,
} from "@/components/entities/entity-table-shell";
import type {
  CustomersListResult,
  SerializedCustomer,
} from "@/features/entities/customers/lib/types";

import { getColumns } from "./columns";

interface CustomersTableProps {
  promise: Promise<CustomersListResult>;
}

export function CustomersTable({ promise }: CustomersTableProps) {
  const router = useRouter();
  const columns = React.useMemo(() => getColumns(), []);
  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedCustomer>) => {
      router.push(`/entities/parties/customers/${row.original.id}`);
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
          externalRef: false,
        },
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
