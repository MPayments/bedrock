import Link from "next/link";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { RequisiteProvidersTable } from "@/features/entities/requisite-providers/components/table";
import { getRequisiteProviders } from "@/features/entities/requisite-providers/lib/queries";
import { searchParamsCache } from "@/features/entities/requisite-providers/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RequisiteProvidersPage({
  searchParams,
}: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getRequisiteProviders(parsedSearch);

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Провайдеры реквизитов"
      description="Справочник институтов и инфраструктур, через которые публикуются реквизиты."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/requisite-providers/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={4} rowCount={10} filterCount={3} />}
    >
      <RequisiteProvidersTable promise={promise} />
    </EntityListPageShell>
  );
}
