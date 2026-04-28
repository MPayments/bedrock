import { Archive, ClipboardList, Workflow } from "lucide-react";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { EntityWorkspaceTabs } from "@/components/entities/workspace-layout";
import { TreasuryOperationsActions } from "@/features/treasury/operations/components/actions";
import { TreasuryInventoryTable } from "@/features/treasury/operations/components/inventory-table";
import { TreasuryOrdersTable } from "@/features/treasury/operations/components/order-table";
import { TreasuryOperationsTable } from "@/features/treasury/operations/components/table";
import {
  getTreasuryInventoryPositions,
  getTreasuryOperations,
  getTreasuryOrders,
} from "@/features/treasury/operations/lib/queries";
import { searchParamsCache } from "@/features/treasury/operations/lib/validations";

interface TreasuryOperationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TreasuryOperationsPage({
  searchParams,
}: TreasuryOperationsPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const view =
    parsedSearch.view === "orders" || parsedSearch.view === "inventory"
      ? parsedSearch.view
      : "runtime";
  const promise =
    view === "orders"
      ? getTreasuryOrders(parsedSearch)
      : view === "inventory"
        ? getTreasuryInventoryPositions(parsedSearch)
        : getTreasuryOperations(parsedSearch);

  return (
    <EntityListPageShell
      icon={Workflow}
      title="Операции"
      description="Список платёжных шагов и FX-исполнений: как связанных со сделками, так и отдельных казначейских ордеров."
      actions={<TreasuryOperationsActions />}
      fallback={<DataTableSkeleton columnCount={6} rowCount={10} filterCount={1} />}
    >
      <div className="mb-4">
        <EntityWorkspaceTabs
          value={view}
          tabs={[
            {
              href: "/treasury/operations?view=runtime",
              icon: Workflow,
              id: "runtime",
              label: "Исполнение",
            },
            {
              href: "/treasury/operations?view=orders",
              icon: ClipboardList,
              id: "orders",
              label: "Ордера",
            },
            {
              href: "/treasury/operations?view=inventory",
              icon: Archive,
              id: "inventory",
              label: "Инвентарь",
            },
          ]}
        />
      </div>
      {view === "orders" ? (
        <TreasuryOrdersTable
          promise={promise as ReturnType<typeof getTreasuryOrders>}
        />
      ) : view === "inventory" ? (
        <TreasuryInventoryTable
          promise={promise as ReturnType<typeof getTreasuryInventoryPositions>}
        />
      ) : (
        <TreasuryOperationsTable
          promise={promise as ReturnType<typeof getTreasuryOperations>}
        />
      )}
    </EntityListPageShell>
  );
}
