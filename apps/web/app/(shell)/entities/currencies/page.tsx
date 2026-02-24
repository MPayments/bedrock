import Link from "next/link";
import { DollarSign, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { CurrenciesTable } from "./(table)";
import { getCurrencies } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CurrenciesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCurrencies(parsedSearch);

  return (
    <EntityListPageShell
      icon={DollarSign}
      title="Валюты"
      description="Справочник валют и параметры точности."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/currencies/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={0} />}
    >
      <CurrenciesTable promise={promise} />
    </EntityListPageShell>
  );
}
