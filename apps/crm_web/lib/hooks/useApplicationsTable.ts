"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColumnFiltersState, SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { API_BASE_URL } from "@/lib/constants";
import { buildApplicationsQueryParams } from "@/lib/applications-query";
import { areFiltersEqual } from "@/lib/utils/table-filters";

export type CurrencyCode = "USD" | "EUR" | "RUB" | "CNY" | "TRY" | "AED";
export type ApplicationStatus = "forming" | "created" | "rejected" | "finished";

export interface ApplicationsRow {
  id: number;
  createdAt: string;
  client: string;
  clientId: number;
  amount: number;
  currency: CurrencyCode;
  amountInBase: number;
  baseCurrencyCode: string;
  hasCalculation: boolean;
  agentName: string;
  comment?: string;
  status: ApplicationStatus;
}

export interface ApplicationsResponse {
  items: ApplicationsRow[];
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApplicationsStatistics {
  totalCount: number;
  totalAmountInBase: number;
  baseCurrencyCode?: string;
  amountsByCurrency?: Record<string, number>;
  maxAmountInBase?: number;
  maxAmountApplicationId?: number | null;
  // Report-currency fields (only present when reportCurrencyCode is used)
  reportCurrencyCode?: string;
  totalAmountInReportCurrency?: number;
  maxAmountInReportCurrency?: number;
}

export interface UseApplicationsTableOptions {
  /** Начальные фильтры по статусу. По умолчанию ["created"] */
  initialStatusFilter?: ApplicationStatus[];
  /** Начальный размер страницы. По умолчанию 20 */
  initialPageSize?: number;
  /** Начальный диапазон дат */
  initialDateRange?: DateRange;
  /** Начальные фильтры колонок (помимо статуса) */
  initialColumnFilters?: ColumnFiltersState;
  /** Optional reporting currency code for report pages (e.g. "RUB", "USD") */
  reportCurrencyCode?: string;
}

export function useApplicationsTable(
  options: UseApplicationsTableOptions = {}
) {
  const {
    initialStatusFilter = ["created"],
    initialPageSize = 20,
    initialDateRange,
    initialColumnFilters = [],
    reportCurrencyCode,
  } = options;

  const [data, setData] = useState<ApplicationsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statistics, setStatistics] = useState<ApplicationsStatistics>({
    totalCount: 0,
    totalAmountInBase: 0,
    baseCurrencyCode: undefined,
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  // Объединяем начальные фильтры: статус + дополнительные фильтры
  const [columnFilters, setColumnFiltersInternal] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (initialStatusFilter.length > 0) {
      filters.push({ id: "status", value: initialStatusFilter });
    }
    // Добавляем дополнительные фильтры, избегая дубликатов
    for (const filter of initialColumnFilters) {
      if (!filters.some((f) => f.id === filter.id)) {
        filters.push(filter);
      }
    }
    return filters;
  });

  // Стабильный setter, который не обновляет состояние, если фильтры не изменились
  const setColumnFilters = useCallback((updater: Updater<ColumnFiltersState>) => {
    setColumnFiltersInternal((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Если фильтры не изменились, возвращаем предыдущий массив (та же ссылка)
      if (areFiltersEqual(prev, next)) {
        return prev;
      }
      return next;
    });
  }, []);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(
    undefined
  );
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(
    undefined
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialDateRange
  );
  const [refetchCounter, setRefetchCounter] = useState(0);

  // Загрузка данных с сервера и статистики
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = buildApplicationsQueryParams({
          pagination,
          sorting,
          columnFilters,
          selectedClientId,
          selectedAgentId,
          dateRange,
        });
        const url = `${API_BASE_URL}/applications?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const response: ApplicationsResponse = await res.json();
        setData(response.items);
        setTotalItems(response.totalItems);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error("Applications fetch error:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    const fetchStatistics = async () => {
      try {
        const params = buildApplicationsQueryParams(
          {
            pagination,
            sorting,
            columnFilters,
            selectedClientId,
            selectedAgentId,
            dateRange,
          },
          { includePagination: false }
        );

        if (reportCurrencyCode) {
          params.set("reportCurrencyCode", reportCurrencyCode);
        }

        const url = `${API_BASE_URL}/applications/statistics?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки статистики: ${res.status}`);
        }

        const stats: ApplicationsStatistics = await res.json();
        setStatistics(stats);
      } catch (err) {
        console.error("Statistics fetch error:", err);
      }
    };

    fetchData();
    fetchStatistics();
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    columnFilters,
    selectedClientId,
    selectedAgentId,
    dateRange,
    refetchCounter,
    reportCurrencyCode,
  ]);

  // Функция для получения текущих параметров запроса (для экспорта)
  const getQueryParams = useCallback(
    (options?: { includePagination?: boolean }) => {
      return buildApplicationsQueryParams(
        {
          pagination,
          sorting,
          columnFilters,
          selectedClientId,
          selectedAgentId,
          dateRange,
        },
        options
      );
    },
    [
      pagination,
      sorting,
      columnFilters,
      selectedClientId,
      selectedAgentId,
      dateRange,
    ]
  );

  const refetch = useCallback(() => {
    setRefetchCounter((c) => c + 1);
  }, []);

  return {
    // Данные
    data,
    loading,
    error,
    totalItems,
    totalPages,
    statistics,

    // Состояние таблицы
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    pagination,
    setPagination,

    // Фильтры combobox
    selectedClientId,
    setSelectedClientId,
    selectedAgentId,
    setSelectedAgentId,

    // Фильтр по дате
    dateRange,
    setDateRange,

    // Методы
    refetch,
    getQueryParams,
  };
}
