import Link from "next/link";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { RequisiteProvidersTable } from "@/features/entities/requisite-providers/components/table";
import { getRequisiteProviders } from "@/features/entities/requisite-providers/lib/queries";

export default async function RequisiteProvidersPage() {
  const promise = getRequisiteProviders();

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
      fallback={<DataTableSkeleton columnCount={4} rowCount={10} filterCount={0} />}
    >
      <RequisiteProvidersTable promise={promise} />
    </EntityListPageShell>
  );
}
