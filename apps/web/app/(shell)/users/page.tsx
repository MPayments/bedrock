import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { UsersTable } from "./components/users-table";
import { getUsers } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getUsers(parsedSearch);

  return (
    <EntityListPageShell
      icon={Users}
      title="Пользователи"
      description="Управление пользователями системы, ролями и доступом."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/users/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Создать</span>
        </Button>
      }
      fallback={
        <DataTableSkeleton columnCount={6} rowCount={10} filterCount={4} />
      }
    >
      <UsersTable promise={promise} />
    </EntityListPageShell>
  );
}
