import { Workflow } from "lucide-react";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryOperationsActions } from "@/features/treasury/operations/components/actions";
import { TreasuryInventoryTable } from "@/features/treasury/operations/components/inventory-table";
import { TreasuryOrdersTable } from "@/features/treasury/operations/components/order-table";
import { TreasuryOperationsTabs } from "@/features/treasury/operations/components/tabs";
import { TreasuryOperationsTable } from "@/features/treasury/operations/components/table";
import {
  getTreasuryInventoryPositions,
  getTreasuryOperations,
  getTreasuryOrders,
} from "@/features/treasury/operations/lib/queries";
import {
  searchParamsCache,
  type TreasuryOperationsSearchParams,
} from "@/features/treasury/operations/lib/validations";

type TreasuryOperationsView = "runtime" | "orders" | "inventory";

interface TreasuryOperationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveTreasuryOperationsView(
  value: TreasuryOperationsSearchParams["view"],
): TreasuryOperationsView {
  switch (value) {
    case "orders":
    case "inventory":
      return value;
    default:
      return "runtime";
  }
}

function renderTreasuryOperationsView(
  view: TreasuryOperationsView,
  search: TreasuryOperationsSearchParams,
) {
  switch (view) {
    case "orders":
      return <TreasuryOrdersTable promise={getTreasuryOrders(search)} />;
    case "inventory":
      return (
        <TreasuryInventoryTable
          promise={getTreasuryInventoryPositions(search)}
        />
      );
    case "runtime":
      return <TreasuryOperationsTable promise={getTreasuryOperations(search)} />;
  }
}

export default async function TreasuryOperationsPage({
  searchParams,
}: TreasuryOperationsPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const view = resolveTreasuryOperationsView(parsedSearch.view);

  return (
    <EntityListPageShell
      icon={Workflow}
      title="Операции"
      description="Список платёжных шагов и FX-исполнений: как связанных со сделками, так и отдельных казначейских ордеров."
      actions={<TreasuryOperationsActions />}
      fallback={
        <DataTableSkeleton columnCount={6} rowCount={10} filterCount={1} />
      }
    >
      <div className="mb-4">
        <TreasuryOperationsTabs value={view} />
      </div>
      {renderTreasuryOperationsView(view, parsedSearch)}
    </EntityListPageShell>
  );
}
