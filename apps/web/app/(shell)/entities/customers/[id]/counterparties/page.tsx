import { Suspense } from "react";

import { CounterpartiesTable } from "@/features/entities/counterparties/components/counterparties-table";
import {
  getCounterparties,
  getCounterpartyGroups,
} from "@/features/entities/counterparties/lib/queries";
import { searchParamsCache } from "@/features/entities/counterparties/lib/validations";
import { DataTableSkeleton } from "@/components/data-table/skeleton";

interface CustomerCounterpartiesPageProps {
  params: Promise<{ id: string }>;
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

export default async function CustomerCounterpartiesPage({
  params,
  searchParams,
}: CustomerCounterpartiesPageProps) {
  const [{ id: customerId }, parsedSearch] = await Promise.all([
    params,
    searchParamsCache.parse(searchParams),
  ]);

  const groupOptions = await getCounterpartyGroups().catch(() => []);
  const customerScopedGroupOptions = groupOptions.filter(
    (group) => group.customerId === customerId,
  );
  const allowedGroupIds = new Set(
    customerScopedGroupOptions.map((group) => group.id),
  );
  const groupIds = normalizeSearchListParam(parsedSearch.groupIds).filter(
    (groupId) => allowedGroupIds.has(groupId),
  );
  const scopedSearch = {
    ...parsedSearch,
    customerId,
    groupIds,
  };
  const promise = getCounterparties(scopedSearch);
  const groupOptionsPromise = Promise.resolve(groupOptions);
  const groupFilterOptionsPromise = Promise.resolve(customerScopedGroupOptions);

  return (
    <div className="flex flex-col gap-4">
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
        }
      >
        <CounterpartiesTable
          promise={promise}
          groupOptionsPromise={groupOptionsPromise}
          groupFilterOptionsPromise={groupFilterOptionsPromise}
        />
      </Suspense>
    </div>
  );
}
