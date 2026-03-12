import Link from "next/link";
import { Wallet, Plus } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { RequisitesTable } from "@/features/entities/requisites/components/table";
import { getRequisites } from "@/features/entities/requisites/lib/queries";

export default async function RequisitesPage() {
  const promise = getRequisites();

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Реквизиты"
      description="Единый каталог реквизитов организаций и контрагентов."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/requisites/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={0} />}
    >
      <RequisitesTable promise={promise} />
    </EntityListPageShell>
  );
}
