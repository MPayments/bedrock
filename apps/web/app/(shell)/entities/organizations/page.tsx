import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { OrganizationsTable } from "@/features/entities/organizations/components/table";
import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { searchParamsCache } from "@/features/entities/organizations/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getOrganizations(parsedSearch);

  return (
    <EntityListPageShell
      icon={Building2}
      title="Организации"
      description="Отдельный справочник собственных организаций."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/organizations/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={
        <DataTableSkeleton columnCount={5} rowCount={10} filterCount={4} />
      }
    >
      <OrganizationsTable promise={promise} />
    </EntityListPageShell>
  );
}
