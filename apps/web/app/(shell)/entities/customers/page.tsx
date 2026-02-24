import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { CustomersTable } from "./components/customers-table";
import { getCustomers } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCustomers(parsedSearch);

  return (
    <EntityListPageShell
      icon={Users}
      title="Клиенты"
      description="Управление клиентами и связанной контрагентской привязкой."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/customers/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={4} rowCount={10} filterCount={2} />}
    >
      <CustomersTable promise={promise} />
    </EntityListPageShell>
  );
}
