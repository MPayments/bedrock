import { Workflow } from "lucide-react";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryOperationsActions } from "@/features/treasury/operations/components/actions";
import { TreasuryOperationsTable } from "@/features/treasury/operations/components/table";
import { getTreasuryOperations } from "@/features/treasury/operations/lib/queries";
import { searchParamsCache } from "@/features/treasury/operations/lib/validations";

interface TreasuryOperationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TreasuryOperationsPage({
  searchParams,
}: TreasuryOperationsPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getTreasuryOperations(parsedSearch);

  return (
    <EntityListPageShell
      icon={Workflow}
      title="Операции"
      description="Список платёжных шагов: как связанных со сделками, так и отдельных казначейских операций."
      actions={<TreasuryOperationsActions />}
      fallback={<DataTableSkeleton columnCount={6} rowCount={10} filterCount={1} />}
    >
      <TreasuryOperationsTable promise={promise} />
    </EntityListPageShell>
  );
}
