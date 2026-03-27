import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryUnmatchedRecordsList } from "@/features/treasury/workbench/components/unmatched-records-list";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import {
  listExecutionInstructions,
  listTreasuryOperations,
  listUnmatchedExternalRecords,
} from "@/features/treasury/workbench/lib/queries";

export default async function TreasuryUnmatchedPage() {
  const [instructions, operations, records, references] = await Promise.all([
    listExecutionInstructions({ limit: 200 }),
    listTreasuryOperations({ limit: 200 }),
    listUnmatchedExternalRecords({ limit: 100 }),
    getTreasuryReferenceData(),
  ]);

  return (
    <EntityListPageShell
      icon={AlertTriangle}
      title="Исключения исполнения"
      description="Внешние записи и другие исключения, по которым treasury еще не знает, к какой инструкции и событию исполнения они относятся."
      fallback={
        <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
      }
    >
      <TreasuryUnmatchedRecordsList
        assetLabels={references.assetLabels}
        instructions={instructions}
        operations={operations}
        records={records}
      />
    </EntityListPageShell>
  );
}
