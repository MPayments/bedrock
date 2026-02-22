import { Suspense } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";

import { OrganizationsTable } from "./components/table";
import {
  getOrganizationCurrencyFilterOptions,
  getOrganizations,
} from "./lib/queries";
import { searchParamsCache } from "./lib/validations";
import { Separator } from "@workspace/ui/components/separator";
import { Button } from "@workspace/ui/components/button";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = Promise.all([
    getOrganizations(parsedSearch),
    getOrganizationCurrencyFilterOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Организации</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Управление организациями и их свойствами.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/organizations/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      </div>
      <Separator className="w-full h-px" />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />
        }
      >
        <OrganizationsTable promise={promise} />
      </Suspense>
    </div>
  );
}
