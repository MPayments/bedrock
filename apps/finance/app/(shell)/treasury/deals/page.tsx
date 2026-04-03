import { Handshake } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { FinanceDealsTable } from "@/features/treasury/deals/components/table";
import { getFinanceDeals } from "@/features/treasury/deals/lib/queries";
import { searchParamsCache } from "@/features/treasury/deals/lib/validations";

interface TreasuryDealsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TreasuryDealsPage({
  searchParams,
}: TreasuryDealsPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getFinanceDeals(parsedSearch);

  return (
    <EntityListPageShell
      icon={Handshake}
      title="Сделки"
      description="Журнал сделок казначейства с фильтрами, очередями и встроенными действиями."
      fallback={<DataTableSkeleton columnCount={11} rowCount={10} filterCount={6} />}
    >
      <FinanceDealsTable promise={promise} />
    </EntityListPageShell>
  );
}
