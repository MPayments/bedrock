import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { CounterpartyRequisitesTable } from "@/features/entities/counterparty-requisites/components/table";
import {
  getCounterpartyRequisiteCurrencyFilterOptions,
  getCounterpartyRequisites,
} from "@/features/entities/counterparty-requisites/lib/queries";
import { searchParamsCache } from "@/features/entities/counterparty-requisites/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CounterpartyRequisitesPage({
  searchParams,
}: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCounterpartyRequisites(parsedSearch);
  const currencyOptionsPromise =
    getCounterpartyRequisiteCurrencyFilterOptions().catch(() => []);

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Реквизиты контрагентов"
      description="Внешние платёжные реквизиты без бухгалтерской привязки к book и balance company."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/counterparty-requisites/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />}
    >
      <CounterpartyRequisitesTable
        promise={promise}
        currencyOptionsPromise={currencyOptionsPromise}
      />
    </EntityListPageShell>
  );
}
