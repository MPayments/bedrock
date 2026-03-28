import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import type { EntityListResult } from "@/components/entities/entity-table-shell";
import { TreasuryUnmatchedRecordsTable } from "@/features/treasury/workbench/components/unmatched-records-table";
import { presentTreasuryExceptions, type TreasuryExceptionTableRow } from "@/features/treasury/workbench/lib/presentation";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import {
  listExecutionInstructions,
  listTreasuryOperations,
  listUnmatchedExternalRecords,
} from "@/features/treasury/workbench/lib/queries";

export default async function TreasuryUnmatchedPage() {
  const [instructions, operations, references] = await Promise.all([
    listExecutionInstructions({ limit: 200 }),
    listTreasuryOperations({ limit: 200 }),
    getTreasuryReferenceData(),
  ]);
  const recordsPromise: Promise<EntityListResult<TreasuryExceptionTableRow>> =
    listUnmatchedExternalRecords({ limit: 100 }).then((records) => {
      const data = presentTreasuryExceptions({ records });

      return {
        data,
        total: data.length,
        limit: Math.max(data.length, 10),
        offset: 0,
      };
    });

  return (
    <EntityListPageShell
      icon={AlertTriangle}
      title="Исключения исполнения"
      description="Внешние записи и другие исключения, по которым treasury еще не знает, к какой инструкции и событию исполнения они относятся."
      fallback={
        <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
      }
    >
      <TreasuryUnmatchedRecordsTable
        assetLabels={references.assetLabels}
        instructions={instructions}
        operations={operations}
        promise={recordsPromise}
      />
    </EntityListPageShell>
  );
}
