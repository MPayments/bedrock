import { TicketPercent } from "lucide-react";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { FxQuotesTable } from "@/features/treasury/quotes/components/table";
import { getFxQuotes } from "@/features/treasury/quotes/lib/queries";
import { searchParamsCache } from "@/features/treasury/quotes/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QuotesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getFxQuotes(parsedSearch);

  return (
    <EntityListPageShell
      icon={TicketPercent}
      title="Котировки"
      description="Журнал FX-котировок со статусом, сроком действия и привязкой к документам."
      fallback={<DataTableSkeleton columnCount={8} rowCount={10} filterCount={3} />}
    >
      <FxQuotesTable promise={promise} />
    </EntityListPageShell>
  );
}
