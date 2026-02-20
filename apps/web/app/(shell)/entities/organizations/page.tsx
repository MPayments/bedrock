import { Suspense } from "react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { apiClient } from "@/lib/api-client";

import type { OrganizationsListResult } from "./(table)";
import { OrganizationsTable } from "./(table)";

interface SearchParams {
  page?: string;
  perPage?: string;
  sort?: string;
  name?: string;
  country?: string;
  baseCurrency?: string;
  isTreasury?: string;
}

async function getOrganizations(searchParams: SearchParams): Promise<OrganizationsListResult> {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  const SORTABLE_COLUMNS = ["name", "country", "baseCurrency", "createdAt", "updatedAt"] as const;
  type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

  let sortBy: SortableColumn | undefined;
  let sortOrder: "asc" | "desc" | undefined;

  if (searchParams.sort) {
    try {
      const parsed = JSON.parse(searchParams.sort);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const col = parsed[0].id as string;
        if (SORTABLE_COLUMNS.includes(col as SortableColumn)) {
          sortBy = col as SortableColumn;
          sortOrder = parsed[0].desc ? "desc" : "asc";
        }
      }
    } catch {
      // invalid sort param, ignore
    }
  }
  const res = await apiClient.v1.organizations.$get({
    query: {
      limit: perPage,
      offset: (page - 1) * perPage,
      sortBy,
      sortOrder,
      name: searchParams.name,
      country: searchParams.country,
      baseCurrency: searchParams.baseCurrency,
      isTreasury: searchParams.isTreasury,
    },
  }, {
    init: { cache: "no-store" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${res.status}`);
  }

  return res.json() as Promise<OrganizationsListResult>;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const promise = getOrganizations(params);

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="font-semibold text-2xl tracking-tight">Организации</h1>
      <Suspense
        fallback={
          <DataTableSkeleton
            columnCount={6}
            rowCount={10}
            filterCount={3}
          />
        }
      >
        <OrganizationsTable promise={promise} />
      </Suspense>
    </div>
  );
}
