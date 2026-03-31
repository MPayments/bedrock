"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColumnFiltersState, SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { API_BASE_URL } from "@/lib/constants";
import { buildDealsQueryParams } from "@/lib/deals-query";
import { areFiltersEqual } from "@/lib/utils/table-filters";

export type CurrencyCode = "USD" | "EUR" | "RUB" | "CNY" | "TRY" | "AED";
export type DealStatus =
  | "draft"
  | "submitted"
  | "rejected"
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

export interface DealsRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  client: string;
  clientId: string;
  amount: number;
  currency: CurrencyCode;
  amountInBase: number;
  baseCurrencyCode: string;
  status: DealStatus;
  agentName: string;
  comment?: string;
  feePercentage: number;
}

export interface DealsResponse {
  data: DealsRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DealsStatistics {
  totalCount: number;
  totalAmountInBase: number;
  baseCurrencyCode?: string;
  activeCount: number;
  doneCount: number;
  // Report-currency fields (only present when reportCurrencyCode is used)
  reportCurrencyCode?: string;
  totalAmountInReportCurrency?: number;
}

export interface UseDealsTableOptions {
  /** Начальные фильтры по статусу */
  initialStatusFilter?: DealStatus[];
  /** Начальный размер страницы. По умолчанию 20 */
  initialPageSize?: number;
  /** Начальный диапазон дат */
  initialDateRange?: DateRange;
  /** Optional reporting currency code for report pages (e.g. "RUB", "USD") */
  reportCurrencyCode?: string;
}

export function useDealsTable(options: UseDealsTableOptions = {}) {
  const {
    initialStatusFilter = [],
    initialPageSize = 20,
    initialDateRange,
    reportCurrencyCode,
  } = options;

  const [data, setData] = useState<DealsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statistics, setStatistics] = useState<DealsStatistics>({
    totalCount: 0,
    totalAmountInBase: 0,
    baseCurrencyCode: undefined,
    activeCount: 0,
    doneCount: 0,
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFiltersInternal] = useState<ColumnFiltersState>(
    initialStatusFilter.length > 0
      ? [{ id: "status", value: initialStatusFilter }]
      : []
  );

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
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(
    undefined
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(
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

        const params = buildDealsQueryParams({
          pagination,
          sorting,
          columnFilters,
          selectedClientId,
          selectedAgentId,
          dateRange,
        });

        const url = `${API_BASE_URL}/deals?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const response: DealsResponse = await res.json();
        setData(response.data ?? []);
        setTotalItems(response.total ?? 0);
        setTotalPages(Math.ceil((response.total ?? 0) / pagination.pageSize));
      } catch (err) {
        console.error("Deals fetch error:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    const fetchStatistics = async () => {
      try {
        const params = buildDealsQueryParams(
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

        const url = `${API_BASE_URL}/deals/statistics?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки статистики: ${res.status}`);
        }

        const stats: DealsStatistics = await res.json();
        setStatistics(stats);
      } catch (err) {
        console.error("Statistics fetch error:", err);
      }
    };

    fetchData();
    fetchStatistics();
  }, [
    pagination,
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
      return buildDealsQueryParams(
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
