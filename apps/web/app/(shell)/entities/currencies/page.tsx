import { Suspense } from "react";
import Link from "next/link";
import { DollarSign, Plus } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";

import { CurrenciesTable } from "./(table)";
import { getCurrencies } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";
import { Separator } from "@bedrock/ui/components/separator";
import { Button } from "@bedrock/ui/components/button";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CurrenciesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCurrencies(parsedSearch);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <DollarSign className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Валюты</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Справочник валют и параметры точности.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/currencies/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      </div>
      <Separator className="w-full h-px" />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={7} rowCount={10} filterCount={0} />
        }
      >
        <CurrenciesTable promise={promise} />
      </Suspense>
    </div>
  );
}
