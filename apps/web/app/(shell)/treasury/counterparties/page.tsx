import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";

import { TreasuryCounterpartiesTable } from "@/features/entities/counterparties/components/counterparties-table";
import {
  filterGroupsByRootCode,
  findSystemRootGroupByCode,
} from "@/features/entities/counterparties/lib/group-scope";
import {
  getCounterparties,
  getCounterpartyGroups,
} from "@/features/entities/counterparties/lib/queries";
import { searchParamsCache } from "@/features/entities/counterparties/lib/validations";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeSearchListParam(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

export default async function CounterpartiesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const groupOptions = await getCounterpartyGroups().catch(() => []);
  const treasuryGroupOptions = filterGroupsByRootCode(groupOptions, "treasury");
  const treasuryRootGroup = findSystemRootGroupByCode(
    treasuryGroupOptions,
    "treasury",
  );
  const groupRoot = normalizeSearchListParam(parsedSearch.groupRoot);
  const groupIds = normalizeSearchListParam(parsedSearch.groupIds);
  const scopedGroupIds = treasuryRootGroup
    ? Array.from(new Set([...groupIds, treasuryRootGroup.id]))
    : groupIds;
  const scopedSearch = {
    ...parsedSearch,
    groupRoot: Array.from(new Set([...groupRoot, "treasury"])),
    groupIds: scopedGroupIds,
  };
  const promise = getCounterparties(scopedSearch);
  const groupOptionsPromise = Promise.resolve(groupOptions);
  const treasuryGroupOptionsPromise = Promise.resolve(treasuryGroupOptions);

  return (
    <EntityListPageShell
      icon={Building2}
      title="Контрагенты"
      description="Контрагенты Казначейства."
      actions={
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/treasury/counterparties/create" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">Создать</span>
        </Button>
      }
      fallback={
        <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
      }
    >
      <TreasuryCounterpartiesTable
        promise={promise}
        groupOptionsPromise={groupOptionsPromise}
        treasuryGroupOptionsPromise={treasuryGroupOptionsPromise}
        treasuryRootGroupId={treasuryRootGroup?.id}
      />
    </EntityListPageShell>
  );
}
