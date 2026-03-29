import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

export interface ApplicationsQueryParamsInput {
  pagination: { pageIndex: number; pageSize: number };
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  selectedClientId?: number;
  selectedAgentId?: string;
  dateRange?: DateRange;
}

/**
 * Строит URLSearchParams для запросов к API заявок.
 * Используется как для списка, так и для статистики и экспорта в Excel.
 */
export function buildApplicationsQueryParams(
  input: ApplicationsQueryParamsInput,
  options?: { includePagination?: boolean }
): URLSearchParams {
  const {
    pagination,
    sorting,
    columnFilters,
    selectedClientId,
    selectedAgentId,
    dateRange,
  } = input;

  const { includePagination = true } = options ?? {};

  const params = new URLSearchParams();

  // Пагинация
  if (includePagination) {
    params.set("offset", String(pagination.pageIndex * pagination.pageSize));
    params.set("limit", String(pagination.pageSize));
  }

  // Сортировка
  if (sorting.length > 0) {
    const sort = sorting[0]!;
    let sortBy = sort.id;
    // Маппинг id колонок на поля API
    if (sortBy === "amountInCurrency") sortBy = "amountOriginal";
    params.set("sortBy", sortBy);
    params.set("sortOrder", sort.desc ? "desc" : "asc");
  }

  // Фильтр по выбранному клиенту из combobox
  if (selectedClientId) {
    params.set("clientId", String(selectedClientId));
  }

  // Фильтр по выбранному агенту из combobox
  if (selectedAgentId) {
    params.set("agentId", String(selectedAgentId));
  }

  // Фильтры из колонок таблицы
  columnFilters.forEach((filter) => {
    if (filter.id === "client" && filter.value) {
      params.set("qClient", String(filter.value));
    } else if (filter.id === "comment" && filter.value) {
      params.set("qComment", String(filter.value));
    } else if (filter.id === "currency" && Array.isArray(filter.value)) {
      params.set("currencies", filter.value.join(","));
    } else if (filter.id === "hasCalculation" && Array.isArray(filter.value)) {
      // Преобразуем "yes"/"no" в boolean
      if (filter.value.length === 1) {
        params.set(
          "hasCalculation",
          filter.value[0] === "yes" ? "true" : "false"
        );
      } else if (filter.value.length === 0) {
        // Если фильтр пустой, не добавляем параметр
      } else {
        // Если выбраны оба значения, то фильтр не нужен (показываем всё)
      }
    } else if (filter.id === "status" && Array.isArray(filter.value)) {
      params.set("status", filter.value.join(","));
    }
  });

  // Фильтр по диапазону дат
  if (dateRange?.from) {
    params.set("dateFrom", format(dateRange.from, "yyyy-MM-dd"));
  }
  if (dateRange?.to) {
    params.set("dateTo", format(dateRange.to, "yyyy-MM-dd"));
  }

  return params;
}
