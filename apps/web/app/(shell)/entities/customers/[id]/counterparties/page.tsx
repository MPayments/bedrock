import { Suspense } from "react";

import {
  CounterpartiesTable,
  type CounterpartiesListResult,
} from "@/app/(shell)/entities/counterparties/components/counterparties-table";
import {
  getCounterparties,
  getCounterpartyGroups,
  type CounterpartyGroupOption,
} from "@/app/(shell)/entities/counterparties/lib/queries";
import { searchParamsCache } from "@/app/(shell)/entities/counterparties/lib/validations";
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

function createEmptyCounterpartiesResult(search: {
  page?: number | null;
  perPage?: number | null;
}): CounterpartiesListResult {
  const perPage =
    typeof search.perPage === "number" && search.perPage > 0
      ? search.perPage
      : 10;
  const page =
    typeof search.page === "number" && search.page > 0 ? search.page : 1;

  return {
    data: [],
    total: 0,
    limit: perPage,
    offset: Math.max(0, (page - 1) * perPage),
  };
}

export default async function CustomerCounterpartiesPage({
  params,
  searchParams,
}: CustomerCounterpartiesPageProps) {
  const [{ id: customerId }, parsedSearch] = await Promise.all([
    params,
    searchParamsCache.parse(searchParams),
  ]);

  const fallbackData = createEmptyCounterpartiesResult(parsedSearch);
  let error: string | null = null;
  let lockedGroupFilterIds: string[] = [];
  let promise: Promise<CounterpartiesListResult> = Promise.resolve(fallbackData);
  let groupOptionsPromise: Promise<CounterpartyGroupOption[]> = Promise.resolve(
    [],
  );
  let groupFilterOptionsPromise: Promise<CounterpartyGroupOption[]> =
    Promise.resolve([]);

  try {
    const groupOptions = await getCounterpartyGroups();
    const customerScopedGroupOptions = groupOptions.filter(
      (group) => group.customerId === customerId,
    );
    const customerRootGroup = customerScopedGroupOptions.find(
      (group) => group.code === `customer:${customerId}`,
    );

    lockedGroupFilterIds = customerRootGroup
      ? [customerRootGroup.id]
      : customerScopedGroupOptions.map((group) => group.id);

    if (lockedGroupFilterIds.length === 0) {
      throw new Error("Customer groups were not resolved");
    }

    const groupIds = normalizeSearchListParam(parsedSearch.groupIds);
    const scopedSearch = {
      ...parsedSearch,
      groupIds: Array.from(new Set([...groupIds, ...lockedGroupFilterIds])),
    };

    promise = getCounterparties(scopedSearch);
    groupOptionsPromise = Promise.resolve(groupOptions);
    groupFilterOptionsPromise = Promise.resolve(customerScopedGroupOptions);
  } catch {
    error = "Не удалось загрузить контрагентов клиента";
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
        }
      >
        <CounterpartiesTable
          promise={promise}
          groupOptionsPromise={groupOptionsPromise}
          groupFilterOptionsPromise={groupFilterOptionsPromise}
          lockedGroupFilterIds={lockedGroupFilterIds}
        />
      </Suspense>
    </div>
  );
}
