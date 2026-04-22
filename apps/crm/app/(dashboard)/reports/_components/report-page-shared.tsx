"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Banknote,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table,
} from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

import { AgentCombobox } from "@/components/dashboard/AgentCombobox";
import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import {
  CURRENCY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/dashboard/dealsColumns";
import { API_BASE_URL } from "@/lib/constants";
import { buildDealsQueryParams } from "@/lib/deals-query";
import type { DealsRow, DealsStatistics } from "@/lib/hooks/useDealsTable";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import type { ChartTooltipLabelFormatter } from "@bedrock/sdk-ui/components/chart";
import { DatePicker } from "@bedrock/sdk-ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableFacetedMultiFilter } from "@bedrock/sdk-tables-ui/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@bedrock/sdk-tables-ui/components/data-table-view-options";

export const REPORT_CURRENCY_OPTIONS = [
  { value: "RUB", label: "RUB" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "CNY", label: "CNY" },
];

export type ChartDataPoint = {
  amount: number;
  closedAmount?: number;
  closedCount?: number;
  count: number;
  cumulativeAmount?: number;
  cumulativeCount?: number;
  date: string;
  CNY?: number;
  EUR?: number;
  RUB?: number;
  USD?: number;
  [key: string]: string | number | undefined;
};

export const CURRENCY_KEYS = ["USD", "EUR", "CNY"] as const;

type SearchParamsLike = {
  get(name: string): string | null;
};

type QueryParamsGetter = (options?: {
  includePagination?: boolean;
}) => URLSearchParams;

export function formatReportChartTick(value: string | number) {
  return format(new Date(value), "d MMM", { locale: ru });
}

export const formatReportChartLabel: ChartTooltipLabelFormatter = (value) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return format(new Date(value), "d MMM yyyy", { locale: ru });
};

export function getInitialDateRange(): DateRange {
  const today = new Date();
  const currentDay = today.getDate();
  const fromDate =
    currentDay < 11
      ? new Date(today.getFullYear(), today.getMonth() - 1, 11)
      : new Date(today.getFullYear(), today.getMonth(), 11);

  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(today);
  toDate.setHours(23, 59, 59, 999);

  return {
    from: fromDate,
    to: toDate,
  };
}

export function normalizeDealsByDayChartData(
  rawData: ChartDataPoint[],
): ChartDataPoint[] {
  return rawData.map((point) => {
    const normalized: ChartDataPoint = { ...point };
    for (const key of CURRENCY_KEYS) {
      if (normalized[key] === undefined) {
        normalized[key] = 0;
      }
    }
    return normalized;
  });
}

export function useReportCurrency(searchParams: SearchParamsLike) {
  const [reportCurrencyCode, setReportCurrencyCode] = useState(
    () => searchParams.get("reportCurrency") || "RUB",
  );

  const handleReportCurrencyChange = useCallback((value: string) => {
    setReportCurrencyCode(value);
    const url = new URL(window.location.href);
    if (value === "RUB") {
      url.searchParams.delete("reportCurrency");
    } else {
      url.searchParams.set("reportCurrency", value);
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  return {
    handleReportCurrencyChange,
    reportCurrencyCode,
  };
}

export function useDealsByDayChart(input: {
  columnFilters: ColumnFiltersState;
  dateRange?: DateRange;
  pagination: PaginationState;
  reportCurrencyCode: string;
  selectedAgentId?: string;
  selectedClientId?: string;
  sorting: SortingState;
}) {
  const {
    columnFilters,
    dateRange,
    pagination,
    reportCurrencyCode,
    selectedAgentId,
    selectedClientId,
    sorting,
  } = input;
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setChartLoading(true);
        const params = buildDealsQueryParams(
          {
            columnFilters,
            dateRange,
            pagination,
            selectedAgentId,
            selectedClientId,
            sorting,
          },
          { includePagination: false },
        );

        if (reportCurrencyCode) {
          params.set("reportCurrencyCode", reportCurrencyCode);
        }

        const response = await fetch(
          `${API_BASE_URL}/deals/by-day?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const json = await response.json();
        const rawData: ChartDataPoint[] = Array.isArray(json)
          ? json
          : (json.data ?? []);

        setChartData(normalizeDealsByDayChartData(rawData));
      } catch (error) {
        console.error("Chart data fetch error:", error);
      } finally {
        setChartLoading(false);
      }
    };

    void fetchChartData();
  }, [
    columnFilters,
    dateRange,
    pagination,
    reportCurrencyCode,
    selectedAgentId,
    selectedClientId,
    sorting,
  ]);

  return {
    chartData,
    chartLoading,
  };
}

export function useReportExcelExport(input: {
  filenamePrefix: string;
  getQueryParams: QueryParamsGetter;
}) {
  const { filenamePrefix, getQueryParams } = input;
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = useCallback(async () => {
    try {
      setExporting(true);

      const params = getQueryParams({ includePagination: false });
      const response = await fetch(
        `${API_BASE_URL}/deals/export-excel?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Ошибка экспорта: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${filenamePrefix}-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export error:", error);
      alert(error instanceof Error ? error.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  }, [filenamePrefix, getQueryParams]);

  return {
    exporting,
    handleExportExcel,
  };
}

export function ReportHeader(props: {
  exporting: boolean;
  loading: boolean;
  onExportExcel: () => void;
  onReportCurrencyChange: (value: string) => void;
  reportCurrencyCode: string;
  title: string;
}) {
  const {
    exporting,
    loading,
    onExportExcel,
    onReportCurrencyChange,
    reportCurrencyCode,
    title,
  } = props;

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs whitespace-nowrap">Валюта отчёта:</span>
          <Select
            value={reportCurrencyCode}
            onValueChange={(value) => {
              if (value) {
                onReportCurrencyChange(value);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_CURRENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={onExportExcel}
          disabled={exporting || loading}
        >
          {exporting ? (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4 animate-pulse" />
              Экспорт...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Скачать Excel
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function ReportMetricsWithChart(props: {
  chartTitle: string;
  children: ReactNode;
  reportCurrencyCode: string;
  statistics: DealsStatistics;
}) {
  const { chartTitle, children, reportCurrencyCode, statistics } = props;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-row gap-4 lg:flex-col lg:w-[260px]">
        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Количество сделок
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalCount}</div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Общая сумма ({reportCurrencyCode})
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                statistics.totalAmountInReportCurrency ??
                  statistics.totalAmountInBase,
                reportCurrencyCode,
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            {chartTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
    </div>
  );
}

export function ReportFiltersCard(props: {
  dateRange?: DateRange;
  error: string | null;
  isAdmin: boolean;
  loading: boolean;
  onOpenDeal: (dealId: string) => void;
  selectedAgentId?: string;
  selectedClientId?: string;
  setDateRange: (value: DateRange | undefined) => void;
  setSelectedAgentId: (value: string | undefined) => void;
  setSelectedClientId: (value: string | undefined) => void;
  table: Table<DealsRow>;
}) {
  const {
    dateRange,
    error,
    isAdmin,
    loading,
    onOpenDeal,
    selectedAgentId,
    selectedClientId,
    setDateRange,
    setSelectedAgentId,
    setSelectedClientId,
    table,
  } = props;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Фильтры отчёта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <DatePicker
              mode="range"
              value={dateRange}
              onChange={setDateRange}
              placeholder="Период..."
              className="w-[280px]"
            />
            <ClientCombobox
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              placeholder="Выбрать клиента..."
              className="w-[250px]"
            />
            {isAdmin ? (
              <AgentCombobox
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                placeholder="Выбрать агента..."
                className="w-[250px]"
              />
            ) : null}
            <DataTableFacetedMultiFilter
              column={table.getColumn("currency")}
              title="Валюта"
              options={CURRENCY_OPTIONS}
            />
            <DataTableFacetedMultiFilter
              column={table.getColumn("status")}
              title="Статус"
              options={STATUS_OPTIONS}
            />
          </div>
          <DataTableViewOptions table={table} />
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="relative">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            </div>
          ) : null}
          <DataTable
            table={table}
            onRowDoubleClick={(row) => onOpenDeal(row.original.id)}
            contextMenuItems={(row) => [
              {
                label: "Открыть",
                onClick: () => onOpenDeal(row.original.id),
              },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
