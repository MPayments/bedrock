"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useSession } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Banknote,
  BarChart3,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ComposedChart,
  LabelList,
} from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { DataTableFacetedFilter } from "@/components/data-table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { AgentCombobox } from "@/components/dashboard/AgentCombobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@bedrock/sdk-ui/components/chart";

import { useDealsTable } from "@/lib/hooks/useDealsTable";
import {
  createDealsColumns,
  getDefaultColumnVisibility,
  formatCurrency,
  CURRENCY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/dashboard/dealsColumns";
import { API_BASE_URL } from "@/lib/constants";
import { buildDealsQueryParams } from "@/lib/deals-query";

const REPORT_CURRENCY_OPTIONS = [
  { value: "RUB", label: "RUB" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "CNY", label: "CNY" },
];

interface ChartDataPoint {
  date: string;
  amount: number;
  count: number;
  closedCount: number;
  closedAmount: number;
  cumulativeCount: number;
  cumulativeAmount: number;
  USD?: number;
  EUR?: number;
  CNY?: number;
  RUB?: number;
  [key: string]: string | number | undefined;
}

// Валюты для Area Chart (без рублей)
const CURRENCY_KEYS = ["USD", "EUR", "CNY"] as const;

// Функция для вычисления начального диапазона дат (с 11 числа до текущего дня)
function getInitialDateRange(): DateRange {
  const today = new Date();
  const currentDay = today.getDate();

  let fromDate: Date;

  if (currentDay < 11) {
    // Если сегодня до 11 числа, то с 11 прошлого месяца
    fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 11);
  } else {
    // Если сегодня 11 и позже, то с 11 текущего месяца
    fromDate = new Date(today.getFullYear(), today.getMonth(), 11);
  }

  // Устанавливаем время на начало дня
  fromDate.setHours(0, 0, 0, 0);

  // Конец диапазона - текущий день
  const toDate = new Date(today);
  toDate.setHours(23, 59, 59, 999);

  return {
    from: fromDate,
    to: toDate,
  };
}

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
  const [exporting, setExporting] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Reporting currency state (persisted in URL)
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

  // Вычисляем начальный диапазон дат (один раз при первом рендере)
  const [initialDateRange] = useState(() => getInitialDateRange());

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

  // Загрузка данных для графика
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setChartLoading(true);
        const params = buildDealsQueryParams(
          {
            pagination,
            sorting,
            columnFilters,
            selectedClientId,
            selectedAgentId,
            dateRange,
          },
          { includePagination: false },
        );

        if (reportCurrencyCode) {
          params.set("reportCurrencyCode", reportCurrencyCode);
        }

        const url = `${API_BASE_URL}/deals/by-day?${params.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const json = await res.json();
        const rawData: ChartDataPoint[] = Array.isArray(json)
          ? json
          : json.data ?? [];

        // Нормализуем данные: для каждой валюты всегда есть число (включая 0)
        const normalizedData: ChartDataPoint[] = rawData.map((point) => {
          const normalized: ChartDataPoint = { ...point };
          for (const key of CURRENCY_KEYS) {
            if (normalized[key] === undefined) {
              normalized[key] = 0;
            }
          }
          return normalized;
        });

        setChartData(normalizedData);
      } catch (err) {
        console.error("Chart data fetch error:", err);
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [
    sorting,
    columnFilters,
    selectedClientId,
    selectedAgentId,
    dateRange,
    pagination,
    reportCurrencyCode,
  ]);

  // Используем переиспользуемые колонки
  const columns = useMemo(() => createDealsColumns({ isAdmin }), [isAdmin]);

  const table = useReactTable({
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

  // Функция экспорта в Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);

      // Получаем параметры без пагинации (для экспорта всех записей)
      const params = getQueryParams({ includePagination: false });

      const url = `${API_BASE_URL}/deals/export-excel?${params.toString()}`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка экспорта: ${res.status}`);
      }

      // Получаем blob и скачиваем
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Получаем имя файла из заголовка или генерируем своё
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `deals-report-${
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
    } catch (err) {
      console.error("Export error:", err);
      alert(err instanceof Error ? err.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Отчёты по сделкам</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs whitespace-nowrap">
              Валюта отчёта:
            </span>
            <Select
              value={reportCurrencyCode}
              onValueChange={(value) => {
                if (value) {
                  handleReportCurrencyChange(value);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CURRENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportExcel}
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

      {/* Одна строка: количество, сумма, график */}
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
              Объем сделок по дням
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
                {/* Легенда слева */}
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

                <ChartContainer
                  config={chartConfig}
                  className="h-[320px] flex-1"
                >
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
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return format(date, "d MMM", { locale: ru });
                      }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => {
                            const date = new Date(value);
                            return format(date, "d MMM yyyy", { locale: ru });
                          }}
                          formatter={(value, name, item) => {
                            const formatted = new Intl.NumberFormat("ru-RU", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }).format(Number(value));

                            if (name === "Новых за день") {
                              const amount = item.payload.amount;
                              return [
                                `${formatted} (${formatCurrency(
                                  amount,
                                  reportCurrencyCode,
                                )})`,
                                "Новых за день",
                              ];
                            }

                            if (name === "Всего на день") {
                              const cumulativeAmount =
                                item.payload.cumulativeAmount;
                              return [
                                `${formatted} (${formatCurrency(
                                  cumulativeAmount,
                                  reportCurrencyCode,
                                )})`,
                                "Всего на день",
                              ];
                            }

                            return [String(value), name];
                          }}
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
                      {/* Количество внутри бара */}
                      <LabelList
                        dataKey="count"
                        position="inside"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                      />
                      {/* Сумма над баром */}
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
                      {/* Количество внутри бара */}
                      <LabelList
                        dataKey="cumulativeCount"
                        position="inside"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={600}
                      />
                      {/* Сумма над баром */}
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Фильтры отчёта</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <DateRangePicker
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
              {isAdmin && (
                <AgentCombobox
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                  placeholder="Выбрать агента..."
                  className="w-[250px]"
                />
              )}
              <DataTableFacetedFilter
                column={table.getColumn("currency") as any}
                title="Валюта"
                options={CURRENCY_OPTIONS}
              />
              <DataTableFacetedFilter
                column={table.getColumn("status") as any}
                title="Статус"
                options={STATUS_OPTIONS}
              />
            </div>
            <DataTableViewOptions table={table} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <div className="text-sm text-muted-foreground">Загрузка...</div>
              </div>
            )}
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/deals/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {loading ? "Загрузка..." : "Нет данных"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
