import * as React from "react";
import { Scale } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import type { EntityListResult } from "@/components/entities/entity-table-shell";
import { TreasuryPositionsTable } from "@/features/treasury/workbench/components/positions-table";
import { presentTreasuryPositions, type TreasuryPositionTableRow } from "@/features/treasury/workbench/lib/presentation";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import { listTreasuryPositions } from "@/features/treasury/workbench/lib/queries";

export default async function TreasuryPositionsPage() {
  const positionsPromise: Promise<EntityListResult<TreasuryPositionTableRow>> =
    Promise.all([
      listTreasuryPositions(),
      getTreasuryReferenceData(),
    ]).then(([positions, references]) => {
      const data = presentTreasuryPositions({
        labels: {
          assetLabels: references.assetLabels,
          counterpartyLabels: references.counterpartyLabels,
          customerLabels: references.customerLabels,
          organizationLabels: references.organizationLabels,
        },
        positions,
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
      icon={Scale}
      title="Позиции казначейства"
      description="Открытые остатки после исполнения: клиентские и внутригрупповые позиции, которые treasury должен закрыть отдельным шагом."
      fallback={
        <DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />
      }
    >
      <TreasuryPositionsTable promise={positionsPromise} />
    </EntityListPageShell>
  );
}
