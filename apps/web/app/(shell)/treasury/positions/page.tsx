import * as React from "react";
import { Scale } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryPositionsList } from "@/features/treasury/workbench/components/positions-list";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import { listTreasuryPositions } from "@/features/treasury/workbench/lib/queries";

export default async function TreasuryPositionsPage() {
  const [positions, references] = await Promise.all([
    listTreasuryPositions(),
    getTreasuryReferenceData(),
  ]);

  return (
    <EntityListPageShell
      icon={Scale}
      title="Позиции казначейства"
      description="Открытые остатки после исполнения: клиентские и внутригрупповые позиции, которые treasury должен закрыть отдельным шагом."
      fallback={
        <DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />
      }
    >
      <TreasuryPositionsList
        assetLabels={references.assetLabels}
        counterpartyLabels={references.counterpartyLabels}
        customerLabels={references.customerLabels}
        organizationLabels={references.organizationLabels}
        positions={positions}
      />
    </EntityListPageShell>
  );
}
