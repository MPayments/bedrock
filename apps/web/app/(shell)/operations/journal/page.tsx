import { BookOpen } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { OperationsJournalTable } from "./components/operations-journal-table";
import { getOperations } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface OperationsJournalPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OperationsJournalPage({
  searchParams,
}: OperationsJournalPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const operationsPromise = getOperations(parsedSearch);

  return (
    <EntityListPageShell
      icon={BookOpen}
      title="Журнал операций"
      description="Операции ledger и детали проводок по шаблонам accounting engine."
      fallback={
        <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
      }
    >
      <OperationsJournalTable promise={operationsPromise} />
    </EntityListPageShell>
  );
}
