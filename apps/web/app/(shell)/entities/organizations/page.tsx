import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { OrganizationsTable } from "@/features/entities/organizations/components/table";
import { getOrganizations } from "@/features/entities/organizations/lib/queries";

export default async function OrganizationsPage() {
  const promise = getOrganizations();

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
      fallback={<DataTableSkeleton columnCount={5} rowCount={10} filterCount={0} />}
    >
      <OrganizationsTable promise={promise} />
    </EntityListPageShell>
  );
}
