import { Workflow } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
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
      description="Очередь материализованных казначейских операций, связанных с процессом исполнения сделки и блокирующими факторами исполнения."
      fallback={<DataTableSkeleton columnCount={8} rowCount={10} filterCount={1} />}
    >
      <TreasuryOperationsTable promise={promise} />
    </EntityListPageShell>
  );
}
