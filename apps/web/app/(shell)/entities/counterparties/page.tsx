import { Suspense } from "react";
import Link from "next/link";
import { Building2, ChevronDown, FolderPlus, Plus } from "lucide-react";

import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@bedrock/ui/components/button-group";
import { Button } from "@bedrock/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";
import { Separator } from "@bedrock/ui/components/separator";

import { DataTableSkeleton } from "@/components/data-table/skeleton";

import { CounterpartiesTable } from "./components/table";
import { getCounterparties, getCounterpartyGroups } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CounterpartiesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const promise = getCounterparties(parsedSearch);
  const groupOptionsPromise = getCounterpartyGroups().catch(() => []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Контрагенты</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Управление контрагентами, группами и клиентской привязкой.
            </p>
          </div>
        </div>
        <ButtonGroup>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/entities/counterparties/create" />}
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
                render={<Link href="/entities/counterparties/groups/create" />}
              >
                <FolderPlus className="h-4 w-4" />
                <span>Создать группу</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
      <Separator className="w-full h-px" />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
        }
      >
        <CounterpartiesTable
          promise={promise}
          groupOptionsPromise={groupOptionsPromise}
        />
      </Suspense>
    </div>
  );
}
