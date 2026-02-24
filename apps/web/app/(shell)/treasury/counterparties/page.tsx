import { Suspense } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import { Separator } from "@bedrock/ui/components/separator";

import { CounterpartiesTable } from "@/app/(shell)/entities/counterparties/components/counterparties-table";
import {
  getCounterparties,
  getCounterpartyGroups,
} from "@/app/(shell)/entities/counterparties/lib/queries";
import {
  filterGroupsByRootCode,
  findSystemRootGroupByCode,
} from "@/app/(shell)/entities/counterparties/lib/group-scope";
import { searchParamsCache } from "@/app/(shell)/entities/counterparties/lib/validations";
import { DataTableSkeleton } from "@/components/data-table/skeleton";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TreasuryCounterpartiesPage({
  searchParams,
}: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const counterpartiesPromise = getCounterparties({
    ...parsedSearch,
    groupRoot: ["treasury"],
  });

  const groupOptions = await getCounterpartyGroups().catch(() => []);
  const treasuryGroupOptions = filterGroupsByRootCode(groupOptions, "treasury");
  const treasuryRootGroup = findSystemRootGroupByCode(
    treasuryGroupOptions,
    "treasury",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Контрагенты</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Контрагенты ветки Казначейство.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/treasury/counterparties/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Создать</span>
        </Button>
      </div>
      <Separator className="w-full h-px" />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
        }
      >
        <CounterpartiesTable
          promise={counterpartiesPromise}
          groupOptionsPromise={Promise.resolve(groupOptions)}
          groupFilterOptionsPromise={Promise.resolve(treasuryGroupOptions)}
          detailsBasePath="/treasury/counterparties"
          lockedGroupFilterIds={
            treasuryRootGroup ? [treasuryRootGroup.id] : undefined
          }
        />
      </Suspense>
    </div>
  );
}
