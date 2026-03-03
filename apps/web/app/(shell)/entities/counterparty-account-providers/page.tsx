import Link from "next/link";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { ProvidersTable } from "@/features/entities/counterparty-account-providers/components/table";
import { getProviders } from "@/features/entities/counterparty-account-providers/lib/queries";
import { searchParamsCache } from "@/features/entities/counterparty-account-providers/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProvidersPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getProviders(parsedSearch);

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Расчетные методы"
      description="Провайдеры счетов: банки, биржи, блокчейн-кастодианы."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/counterparty-account-providers/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={0} />}
    >
      <ProvidersTable promise={promise} />
    </EntityListPageShell>
  );
}
