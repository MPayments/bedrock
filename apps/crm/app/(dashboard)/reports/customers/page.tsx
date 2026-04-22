"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
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
  ChartLegend,
  ChartLegendContent,
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
  amount: {
    label: "Сумма",
    color: "#f97316", // оранжевый
  },
  count: {
    label: "Сделок",
    color: "#60a5fa", // голубой для баров
  },
} satisfies ChartConfig;

export default function ClientsReportsPage() {
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
    filenamePrefix: "client-deals-report",
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

  const formatReportChartTooltip: ChartTooltipFormatter = (value, name) => {
    if (name === "Сумма") {
      return [formatCurrency(Number(value), reportCurrencyCode), "Сумма"];
    }

    if (name === "Сделок") {
      const formatted = new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(value));

      return [formatted, "Сделок"];
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
        title="Отчёты по клиентам"
      />

      <ReportMetricsWithChart
        chartTitle={`Суммы и объем сделок по дням (${reportCurrencyCode})`}
        reportCurrencyCode={reportCurrencyCode}
        statistics={statistics}
      >
        {chartLoading ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Загрузка...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Нет данных
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <ComposedChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <YAxis yAxisId="left" hide />
              <YAxis
                yAxisId="right"
                orientation="right"
                hide
                allowDecimals={false}
              />
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
                    formatter={formatReportChartTooltip}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="count"
                name="Сделок"
                yAxisId="right"
                fill="var(--color-count)"
                opacity={0.4}
                barSize={18}
                radius={[3, 3, 0, 0]}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fontSize: 10, fill: "#60a5fa" }}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey="amount"
                name="Сумма"
                yAxisId="left"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
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
