import Link from "next/link";
import { Building2, ChevronDown, FolderPlus, Plus } from "lucide-react";

import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@multihansa/ui/components/button-group";
import { Button } from "@multihansa/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@multihansa/ui/components/dropdown-menu";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { CounterpartiesTable } from "@/features/entities/counterparties/components/counterparties-table";
import { getCounterparties, getCounterpartyGroups } from "@/features/entities/counterparties/lib/queries";
import { searchParamsCache } from "@/features/entities/counterparties/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CounterpartiesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCounterparties(parsedSearch);
  const groupOptionsPromise = getCounterpartyGroups().catch(() => []);

  return (
    <EntityListPageShell
      icon={Building2}
      title="Контрагенты"
      description="Управление контрагентами, группами и клиентской привязкой."
      actions={
        <ButtonGroup>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/entities/parties/counterparties/create" />}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden md:block">Создать</span>
          </Button>
          <ButtonGroupSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="lg" aria-label="Открыть меню создания" />}
            >
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-46">
              <DropdownMenuItem
                render={<Link href="/entities/parties/counterparties/groups/create" />}
              >
                <FolderPlus className="h-4 w-4" />
                <span>Создать группу</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      }
      fallback={<DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />}
    >
      <CounterpartiesTable
        promise={promise}
        groupOptionsPromise={groupOptionsPromise}
      />
    </EntityListPageShell>
  );
}
