"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import type { EntityListResult } from "@/components/entities/entity-table-shell";
import { useDataTable } from "@/hooks/use-data-table";

import type { TreasuryOperationTableRow } from "../lib/presentation";
import { treasuryOperationsTableColumns } from "./operations-table-columns";

type TreasuryOperationsTableProps = {
  promise: Promise<EntityListResult<TreasuryOperationTableRow>>;
};

export function TreasuryOperationsTable({
  promise,
}: TreasuryOperationsTableProps) {
  const router = useRouter();
  const result = React.use(promise);
  const { table } = useDataTable({
    data: result.data,
    columns: treasuryOperationsTableColumns,
    pageCount: Math.max(1, Math.ceil(result.total / result.limit)),
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
  });

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<TreasuryOperationTableRow>) => {
      router.push(`/treasury/operations/${row.original.id}`);
    },
    [router],
  );

  if (result.data.length === 0) {
    return (
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Операции</CardTitle>
          <CardDescription>
            Здесь появятся treasury-операции после их создания из этой рабочей
            зоны.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-xl border border-dashed px-4 py-6">
            <div className="text-sm font-medium">Операций пока нет</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Создайте первую treasury-операцию. Для валютной конверсии
              используйте отдельный treasury FX.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DataTable
      table={table}
      onRowDoubleClick={(row) => handleRowDoubleClick(row)}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
