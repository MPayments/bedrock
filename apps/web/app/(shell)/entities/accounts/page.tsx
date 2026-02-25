import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { AccountsTable } from "./(table)";
import { getAccountCurrencyFilterOptions, getAccounts } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountsPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getAccounts(parsedSearch);
  const currencyOptionsPromise = getAccountCurrencyFilterOptions().catch(
    () => [],
  );

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Счета"
      description="Счета контрагентов у провайдеров."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/accounts/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={8} rowCount={10} filterCount={2} />}
    >
      <AccountsTable
        promise={promise}
        currencyOptionsPromise={currencyOptionsPromise}
      />
    </EntityListPageShell>
  );
}
