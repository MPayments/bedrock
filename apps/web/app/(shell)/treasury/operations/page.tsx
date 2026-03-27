import * as React from "react";
import Link from "next/link";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import type { EntityListResult } from "@/components/entities/entity-table-shell";
import { TreasuryOperationsTable } from "@/features/treasury/workbench/components/operations-table";
import { presentTreasuryOperationsTable, type TreasuryOperationTableRow } from "@/features/treasury/workbench/lib/presentation";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import {
  listTreasuryAccounts,
  listTreasuryOperations,
} from "@/features/treasury/workbench/lib/queries";

export default async function TreasuryOperationsPage() {
  const createOperationHref = "/treasury/operations/create";
  const operationsPromise: Promise<EntityListResult<TreasuryOperationTableRow>> =
    Promise.all([
      listTreasuryAccounts(),
      listTreasuryOperations({ limit: 100 }),
      getTreasuryReferenceData(),
    ]).then(([accounts, operations, references]) => {
      const data = presentTreasuryOperationsTable({
        accounts,
        labels: {
          assetLabels: references.assetLabels,
          organizationLabels: references.organizationLabels,
        },
        operations,
      });

      return {
        data,
        total: data.length,
        limit: Math.max(data.length, 10),
        offset: 0,
      };
    });

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Операции казначейства"
      description="Ручные treasury-операции: выплаты, поступления, внутренние переводы, возвраты и корректировки."
      actions={
        <div className="shrink-0">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={createOperationHref} />}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden md:block">Новая операция</span>
          </Button>
        </div>
      }
      fallback={
        <DataTableSkeleton columnCount={8} rowCount={10} filterCount={3} />
      }
    >
      <TreasuryOperationsTable promise={operationsPromise} />
    </EntityListPageShell>
  );
}
