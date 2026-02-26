import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import {
  getAccountingOrgOptions,
  getCounterpartyGroupOptions,
  getFinancialResultsByCounterparty,
  getFinancialResultsByGroup,
  type FinancialResultSummaryByCurrencyDto,
  type FinancialResultsByCounterpartyDto,
  type FinancialResultsByGroupDto,
} from "../lib/queries";

interface AccountingFinancialResultsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getFirstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getMultiParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  if (!value) return [];

  const parts = Array.isArray(value) ? value : [value];
  return parts
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatMinor(value: string) {
  try {
    return BigInt(value).toLocaleString("ru-RU");
  } catch {
    return value;
  }
}

function buildPageHref(
  raw: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (key === "page") continue;

    if (Array.isArray(value)) {
      for (const part of value) {
        params.append(key, part);
      }
      continue;
    }

    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  params.set("page", String(page));
  return `/accounting/financial-results?${params.toString()}`;
}

function SummaryTable({
  summary,
}: {
  summary: FinancialResultSummaryByCurrencyDto[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Currency</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Expense</TableHead>
          <TableHead className="text-right">Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summary.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground h-12 text-center">
              Данные отсутствуют
            </TableCell>
          </TableRow>
        ) : (
          summary.map((row) => (
            <TableRow key={row.currency}>
              <TableCell>{row.currency}</TableCell>
              <TableCell className="text-right">{formatMinor(row.revenueMinor)}</TableCell>
              <TableCell className="text-right">{formatMinor(row.expenseMinor)}</TableCell>
              <TableCell className="text-right">{formatMinor(row.netMinor)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default async function AccountingFinancialResultsPage({
  searchParams,
}: AccountingFinancialResultsPageProps) {
  const rawSearchParams = await searchParams;
  const orgOptions = await getAccountingOrgOptions();
  const groupOptions = await getCounterpartyGroupOptions();

  const scope = getFirstParam(rawSearchParams, "scope") === "group" ? "group" : "counterparty";
  const attributionMode =
    getFirstParam(rawSearchParams, "attributionMode") === "analytic_counterparty"
      ? "analytic_counterparty"
      : "book_org";
  const status = getMultiParam(rawSearchParams, "status");
  const selectedStatuses = status.length > 0 ? status : ["posted", "pending"];
  const includeDescendants =
    getFirstParam(rawSearchParams, "includeDescendants") === "false"
      ? "false"
      : "true";
  const currency = getFirstParam(rawSearchParams, "currency") ?? "";
  const from = getFirstParam(rawSearchParams, "from") ?? "";
  const to = getFirstParam(rawSearchParams, "to") ?? "";
  const counterpartyId = getFirstParam(rawSearchParams, "counterpartyId") ?? "";
  const groupId = getFirstParam(rawSearchParams, "groupId") ?? "";
  const selectedGroupIds = getMultiParam(rawSearchParams, "groupId");
  const page = Number(getFirstParam(rawSearchParams, "page") ?? "1");
  const perPage = Number(getFirstParam(rawSearchParams, "perPage") ?? "20");
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPerPage =
    Number.isFinite(perPage) && perPage > 0 ? Math.min(Math.floor(perPage), 100) : 20;
  const offset = (normalizedPage - 1) * normalizedPerPage;

  const commonQuery: Record<string, string | string[]> = {
    attributionMode,
    status: selectedStatuses,
    includeDescendants,
    limit: String(normalizedPerPage),
    offset: String(offset),
    sortBy: getFirstParam(rawSearchParams, "sortBy") ?? "netMinor",
    sortOrder: getFirstParam(rawSearchParams, "sortOrder") ?? "desc",
  };

  if (currency) {
    commonQuery.currency = currency.toUpperCase();
  }
  if (from) {
    commonQuery.from = from;
  }
  if (to) {
    commonQuery.to = to;
  }

  let counterpartyResult: FinancialResultsByCounterpartyDto | null = null;
  let groupResult: FinancialResultsByGroupDto | null = null;
  let queryError: string | null = null;

  try {
    if (scope === "counterparty") {
      const query = { ...commonQuery };
      if (counterpartyId) {
        query.counterpartyId = counterpartyId;
      }
      if (groupId) {
        query.groupId = groupId;
      }
      counterpartyResult = await getFinancialResultsByCounterparty(query);
    } else if (selectedGroupIds.length > 0) {
      groupResult = await getFinancialResultsByGroup({
        ...commonQuery,
        groupId: selectedGroupIds,
      });
    }
  } catch (error) {
    queryError = error instanceof Error ? error.message : String(error);
  }

  const total = scope === "counterparty" ? (counterpartyResult?.total ?? 0) : (groupResult?.total ?? 0);
  const currentPage = normalizedPage;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPerPage));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Финансовый результат</CardTitle>
          <CardDescription>
            Отчет по доходам/расходам в разрезе контрагентов и групп.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="scope">
                Scope
              </label>
              <select
                id="scope"
                name="scope"
                defaultValue={scope}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="counterparty">By Counterparty</option>
                <option value="group">By Group</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="attributionMode">
                Attribution
              </label>
              <select
                id="attributionMode"
                name="attributionMode"
                defaultValue={attributionMode}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="book_org">Book Org (entity-level)</option>
                <option value="analytic_counterparty">Counterparty (from dimensions)</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                multiple
                defaultValue={selectedStatuses}
                className="border-input bg-background min-h-24 rounded-md border px-3 py-2 text-sm"
              >
                <option value="pending">pending</option>
                <option value="posted">posted</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="includeDescendants">
                Include descendants
              </label>
              <select
                id="includeDescendants"
                name="includeDescendants"
                defaultValue={includeDescendants}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="currency">
                Currency
              </label>
              <input
                id="currency"
                name="currency"
                defaultValue={currency}
                placeholder="USD"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="from">
                From (ISO)
              </label>
              <input
                id="from"
                name="from"
                defaultValue={from}
                placeholder="2026-01-01T00:00:00.000Z"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="to">
                To (ISO)
              </label>
              <input
                id="to"
                name="to"
                defaultValue={to}
                placeholder="2026-12-31T23:59:59.999Z"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="perPage">
                Rows per page
              </label>
              <input
                id="perPage"
                name="perPage"
                type="number"
                min={1}
                max={100}
                defaultValue={normalizedPerPage}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>

            {scope === "counterparty" ? (
              <>
                <div className="grid gap-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="counterpartyId">
                    Counterparty
                  </label>
                  <select
                    id="counterpartyId"
                    name="counterpartyId"
                    defaultValue={counterpartyId}
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  >
                    <option value="">All</option>
                    {orgOptions.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="groupId">
                    Group filter
                  </label>
                  <select
                    id="groupId"
                    name="groupId"
                    defaultValue={groupId}
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  >
                    <option value="">All groups</option>
                    {groupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.code})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="grid gap-1 md:col-span-4">
                <label className="text-sm font-medium" htmlFor="groupId">
                  Groups
                </label>
                <select
                  id="groupId"
                  name="groupId"
                  multiple
                  defaultValue={selectedGroupIds}
                  className="border-input bg-background min-h-32 rounded-md border px-3 py-2 text-sm"
                >
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end gap-2 md:col-span-4">
              <button
                type="submit"
                className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm"
              >
                Применить
              </button>
              <Link
                href="/accounting/financial-results"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm leading-9"
              >
                Сброс
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {queryError ? (
        <Card className="rounded-sm border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка запроса</CardTitle>
            <CardDescription>{queryError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {scope === "counterparty" ? (
        <>
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Summary by currency</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SummaryTable summary={counterpartyResult?.summaryByCurrency ?? []} />
            </CardContent>
          </Card>
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>By Counterparty</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expense</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(counterpartyResult?.data.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                        Данные не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    counterpartyResult!.data.map((row) => (
                      <TableRow key={`${row.counterpartyId ?? "unattributed"}:${row.currency}`}>
                        <TableCell>{row.counterpartyName ?? "Unattributed"}</TableCell>
                        <TableCell>{row.currency}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.revenueMinor)}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.expenseMinor)}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.netMinor)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Summary by currency</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SummaryTable summary={groupResult?.summaryByCurrency ?? []} />
            </CardContent>
          </Card>
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>By Group</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expense</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(groupResult?.data.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                        Данные не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupResult!.data.map((row) => (
                      <TableRow key={`${row.groupId}:${row.currency}`}>
                        <TableCell>{row.groupName ?? row.groupId}</TableCell>
                        <TableCell>{row.currency}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.revenueMinor)}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.expenseMinor)}</TableCell>
                        <TableCell className="text-right">{formatMinor(row.netMinor)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {attributionMode === "analytic_counterparty" ? (
            <Card className="rounded-sm">
              <CardHeader className="border-b">
                <CardTitle>Unattributed</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <SummaryTable summary={groupResult?.unattributedByCurrency ?? []} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Всего: {total}. Страница {currentPage} из {totalPages}
        </p>
        <div className="flex gap-2">
          {canGoPrev ? (
            <a
              href={buildPageHref(rawSearchParams, currentPage - 1)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm leading-9"
            >
              Назад
            </a>
          ) : (
            <span className="text-muted-foreground border-input bg-background h-9 rounded-md border px-3 text-sm leading-9">
              Назад
            </span>
          )}
          {canGoNext ? (
            <a
              href={buildPageHref(rawSearchParams, currentPage + 1)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm leading-9"
            >
              Вперед
            </a>
          ) : (
            <span className="text-muted-foreground border-input bg-background h-9 rounded-md border px-3 text-sm leading-9">
              Вперед
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
