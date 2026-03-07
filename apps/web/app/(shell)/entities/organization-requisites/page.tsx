import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { OrganizationRequisitesTable } from "@/features/entities/organization-requisites/components/table";
import {
  getOrganizationRequisiteCurrencyFilterOptions,
  getOrganizationRequisites,
} from "@/features/entities/organization-requisites/lib/queries";
import { searchParamsCache } from "@/features/entities/organization-requisites/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrganizationRequisitesPage({
  searchParams,
}: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getOrganizationRequisites(parsedSearch);
  const currencyOptionsPromise =
    getOrganizationRequisiteCurrencyFilterOptions().catch(() => []);

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Реквизиты организаций"
      description="Расчётные реквизиты внутренних компаний с отдельной бухгалтерской привязкой."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/organization-requisites/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />}
    >
      <OrganizationRequisitesTable
        promise={promise}
        currencyOptionsPromise={currencyOptionsPromise}
      />
    </EntityListPageShell>
  );
}
