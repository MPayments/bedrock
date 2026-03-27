import { BookOpen } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { OperationsJournalTable } from "@/features/operations/journal/components/operations-journal-table";
import { getOperations } from "@/features/operations/journal/lib/queries";
import { searchParamsCache } from "@/features/operations/journal/lib/validations";
import { requirePageAudience } from "@/lib/auth/session";

interface OperationsJournalPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OperationsJournalPage({
  searchParams,
}: OperationsJournalPageProps) {
  await requirePageAudience("user");

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
