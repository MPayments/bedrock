"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import {
  createDealsColumns,
  getDefaultColumnVisibility,
} from "@/components/dashboard/dealsColumns";
import { useSession } from "@/lib/auth-client";
import { useDealsTable, type DealsRow } from "@/lib/hooks/useDealsTable";
import { formatCurrency } from "@/lib/utils/currency";
import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
  type ChartTooltipFormatter,
} from "@bedrock/sdk-ui/components/chart";
import {
  formatReportChartLabel,
  formatReportChartTick,
  getInitialDateRange,
  ReportFiltersCard,
  ReportHeader,
  ReportMetricsWithChart,
  useDealsByDayChart,
  useReportCurrency,
  useReportExcelExport,
} from "../_components/report-page-shared";

const chartConfig = {
  count: {
    label: "Новых за день",
    color: "#22c55e", // зеленый для новых
  },
  cumulativeCount: {
    label: "Всего на день",
    color: "#3b82f6", // синий для накопительного
  },
} satisfies ChartConfig;

// Форматирование суммы для отображения над баром (сокращённый формат)
function formatAmountShort(
  value: number,
  currencyCode: string = "RUB",
): string {
  const sym = currencyCode;
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ${sym}`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K ${sym}`;
  }
  return `${value.toFixed(0)} ${sym}`;
}

export default function DealsReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { handleReportCurrencyChange, reportCurrencyCode } =
    useReportCurrency(searchParams);
  const initialDateRange = useMemo(() => getInitialDateRange(), []);

  // Начальные фильтры: все статусы кроме cancelled
  const initialStatusFilter: Array<
    | "preparing_documents"
    | "awaiting_funds"
    | "awaiting_payment"
    | "closing_documents"
    | "done"
  > = [
    "preparing_documents",
    "awaiting_funds",
    "awaiting_payment",
    "closing_documents",
    "done",
  ];

  // Используем переиспользуемый хук с начальными фильтрами
  const {
    data,
    loading,
    error,
    totalPages,
    statistics,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    pagination,
    setPagination,
    selectedClientId,
    setSelectedClientId,
    selectedAgentId,
    setSelectedAgentId,
    dateRange,
    setDateRange,
    getQueryParams,
  } = useDealsTable({
    initialStatusFilter,
    initialPageSize: 200, // Максимальное значение (ограничение API)
    initialDateRange, // Передаём начальный диапазон дат сразу
    reportCurrencyCode,
  });

  const { chartData, chartLoading } = useDealsByDayChart({
    sorting,
    columnFilters,
    selectedClientId,
    selectedAgentId,
    dateRange,
    pagination,
    reportCurrencyCode,
  });

  const { exporting, handleExportExcel } = useReportExcelExport({
    filenamePrefix: "deals-report",
    getQueryParams,
  });

  // Используем переиспользуемые колонки
  const columns = useMemo(() => createDealsColumns(), []);

  const table = useReactTable<DealsRow>({
    data,
    columns,
    pageCount: totalPages,
    state: {
      sorting,
      columnFilters,
      pagination,
      columnVisibility: getDefaultColumnVisibility(isAdmin),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const formatDealsChartTooltip: ChartTooltipFormatter = (
    value,
    name,
    item,
  ) => {
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value));
    const payload = item.payload as
      | {
          amount?: number;
          cumulativeAmount?: number;
        }
      | undefined;

    if (name === "Новых за день") {
      return [
        `${formatted} (${formatCurrency(
          Number(payload?.amount ?? 0),
          reportCurrencyCode,
        )})`,
        "Новых за день",
      ];
    }

    if (name === "Всего на день") {
      return [
        `${formatted} (${formatCurrency(
          Number(payload?.cumulativeAmount ?? 0),
          reportCurrencyCode,
        )})`,
        "Всего на день",
      ];
    }

    return [String(value), name];
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        exporting={exporting}
        loading={loading}
        onExportExcel={handleExportExcel}
        onReportCurrencyChange={handleReportCurrencyChange}
        reportCurrencyCode={reportCurrencyCode}
        title="Отчёты по сделкам"
      />

      <ReportMetricsWithChart
        chartTitle="Объем сделок по дням"
        reportCurrencyCode={reportCurrencyCode}
        statistics={statistics}
      >
        {chartLoading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            Загрузка...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            Нет данных
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-2 pt-8 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: "#22c55e" }}
                />
                <span className="whitespace-nowrap">Новых за день</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: "#3b82f6" }}
                />
                <span className="whitespace-nowrap">Всего на день</span>
              </div>
            </div>

            <ChartContainer config={chartConfig} className="h-[320px] flex-1">
              <ComposedChart
                data={chartData}
                margin={{ top: 40, right: 10, bottom: 10, left: 10 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <YAxis hide allowDecimals={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tick={{ fontSize: 10 }}
                  tickFormatter={formatReportChartTick}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={formatReportChartLabel}
                      formatter={formatDealsChartTooltip}
                      indicator="dot"
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  name="Новых за день"
                  fill="var(--color-count)"
                  barSize={20}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList
                    dataKey="count"
                    position="inside"
                    fill="#fff"
                    fontSize={10}
                    fontWeight={600}
                  />
                  <LabelList
                    dataKey="amount"
                    position="top"
                    fill="#22c55e"
                    fontSize={9}
                    fontWeight={500}
                    formatter={(value: number) =>
                      formatAmountShort(value, reportCurrencyCode)
                    }
                    offset={2}
                  />
                </Bar>
                <Bar
                  dataKey="cumulativeCount"
                  name="Всего на день"
                  fill="var(--color-cumulativeCount)"
                  barSize={20}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList
                    dataKey="cumulativeCount"
                    position="inside"
                    fill="#fff"
                    fontSize={10}
                    fontWeight={600}
                  />
                  <LabelList
                    dataKey="cumulativeAmount"
                    position="top"
                    fill="#3b82f6"
                    fontSize={9}
                    fontWeight={500}
                    formatter={(value: number) =>
                      formatAmountShort(value, reportCurrencyCode)
                    }
                    offset={2}
                  />
                </Bar>
              </ComposedChart>
            </ChartContainer>
          </div>
        )}
      </ReportMetricsWithChart>

      <ReportFiltersCard
        dateRange={dateRange}
        error={error}
        isAdmin={isAdmin}
        loading={loading}
        onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
        selectedAgentId={selectedAgentId}
        selectedClientId={selectedClientId}
        setDateRange={setDateRange}
        setSelectedAgentId={setSelectedAgentId}
        setSelectedClientId={setSelectedClientId}
        table={table}
      />
    </div>
  );
}
