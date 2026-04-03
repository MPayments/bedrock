import { Handshake } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { CustomersTable } from "@/features/entities/customers/components/customers-table";
import { getCustomers } from "@/features/entities/customers/lib/queries";
import { searchParamsCache } from "@/features/entities/customers/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCustomers(parsedSearch);

  return (
    <EntityListPageShell
      icon={Handshake}
      title="Клиенты"
      description="Управление клиентами и связанной контрагентской привязкой."
      fallback={
        <DataTableSkeleton columnCount={4} rowCount={10} filterCount={2} />
      }
    >
      <CustomersTable promise={promise} />
    </EntityListPageShell>
  );
}
