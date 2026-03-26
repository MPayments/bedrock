import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

/**
 * Строит параметры запроса для сделок
 */
export function buildDealsQueryParams(
  params: {
    pagination: { pageIndex: number; pageSize: number };
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    selectedClientId?: number;
    selectedAgentId?: number;
    dateRange?: DateRange;
  },
  options?: { includePagination?: boolean }
): URLSearchParams {
  const {
    pagination,
    sorting,
    columnFilters,
    selectedClientId,
    selectedAgentId,
    dateRange,
  } = params;
  const { includePagination = true } = options || {};

  const searchParams = new URLSearchParams();

  // Пагинация
  if (includePagination) {
    searchParams.set("page", (pagination.pageIndex + 1).toString());
    searchParams.set("limit", pagination.pageSize.toString());
  }

  // Сортировка
  if (sorting.length > 0) {
    const firstSort = sorting[0]!;
    searchParams.set("sortBy", firstSort.id);
    searchParams.set("sortOrder", firstSort.desc ? "desc" : "asc");
  }

  // Фильтры
  for (const filter of columnFilters) {
    if (filter.id === "currency" && Array.isArray(filter.value)) {
      searchParams.set("currencies", filter.value.join(","));
    }
    if (filter.id === "status" && Array.isArray(filter.value)) {
      searchParams.set("statuses", filter.value.join(","));
    }
    if (filter.id === "qClient" && typeof filter.value === "string") {
      searchParams.set("qClient", filter.value);
    }
    if (filter.id === "comment" && typeof filter.value === "string") {
      searchParams.set("qComment", filter.value);
    }
  }

  // Фильтр по клиенту
  if (selectedClientId !== undefined) {
    searchParams.set("clientId", selectedClientId.toString());
  }

  // Фильтр по агенту
  if (selectedAgentId !== undefined) {
    searchParams.set("agentId", selectedAgentId.toString());
  }

  // Фильтр по дате
  if (dateRange?.from) {
    searchParams.set("dateFrom", dateRange.from.toISOString());
  }
  if (dateRange?.to) {
    searchParams.set("dateTo", dateRange.to.toISOString());
  }

  return searchParams;
}
