import { Suspense } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";

import { CustomersTable } from "./components/customers-table";
import { getCustomers } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";
import { Separator } from "@bedrock/ui/components/separator";
import { Button } from "@bedrock/ui/components/button";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCustomers(parsedSearch);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Клиенты</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Управление клиентами и связанной контрагентской привязкой.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/entities/customers/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Добавить</span>
        </Button>
      </div>
      <Separator className="w-full h-px" />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={4} rowCount={10} filterCount={2} />
        }
      >
        <CustomersTable promise={promise} />
      </Suspense>
    </div>
  );
}
