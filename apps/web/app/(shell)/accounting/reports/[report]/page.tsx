import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multihansa/ui/components/card";

import {
  getAccountingOrgOptions,
  getBalanceSheet,
  getCashFlow,
  getClosePackage,
  getCounterpartyGroupOptions,
  getFeeRevenue,
  getFxRevaluation,
  getGeneralLedger,
  getIncomeStatement,
  getLiquidity,
  getTrialBalance,
  type AccountingReportKey,
} from "@/features/accounting/lib/queries";

import {
  buildReportOverviewCards,
  buildReportSections,
  ReportOverviewCards,
  ReportSectionTable,
} from "./report-presenter";

interface AccountingReportPageProps {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const REPORT_META: Record<
  AccountingReportKey,
  { title: string; description: string }
> = {
  "trial-balance": {
    title: "Оборотно-сальдовая ведомость (ОСВ)",
    description:
      "Входящее сальдо, дебет/кредит за период и исходящее сальдо по счетам и валютам.",
  },
  "general-ledger": {
    title: "Главная книга (карточка счета)",
    description: "Карточка счета с движениями и нарастающим остатком.",
  },
  "balance-sheet": {
    title: "Бухгалтерский баланс",
    description: "Баланс на дату по строкам отчетности.",
  },
  "income-statement": {
    title: "Отчет о финансовых результатах",
    description: "Доходы, расходы и финансовый результат за период.",
  },
  "cash-flow": {
    title: "Отчет о движении денежных средств",
    description: "Денежные потоки прямым или косвенным методом.",
  },
  liquidity: {
    title: "Позиция ликвидности",
    description: "Ликвидность в разрезе книг, организаций и валют.",
  },
  "fx-revaluation": {
    title: "Переоценка валютных позиций",
    description:
      "Реализованный и нереализованный результат по курсовым разницам.",
  },
  "fee-revenue": {
    title: "Анализ комиссионных доходов",
    description:
      "Разбивка комиссионной выручки по продукту, каналу и контрагенту.",
  },
  "close-package": {
    title: "Пакет закрытия периода",
    description: "Пакет закрытия периода с ревизиями и событиями аудита.",
  },
};

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
  if (!value) {
    return [];
  }

  const chunks = Array.isArray(value) ? value : [value];
  return chunks
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isReportKey(value: string): value is AccountingReportKey {
  return value in REPORT_META;
}

function buildPageHref(
  report: AccountingReportKey,
  raw: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (key === "page") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (value) {
      params.set(key, value);
    }
  }

  params.set("page", String(page));
  return `/accounting/reports/${report}?${params.toString()}`;
}

export default async function AccountingReportPage({
  params,
  searchParams,
}: AccountingReportPageProps) {
  const [{ report: reportParam }, rawSearchParams, orgOptions, groupOptions] =
    await Promise.all([
      params,
      searchParams,
      getAccountingOrgOptions(),
      getCounterpartyGroupOptions(),
    ]);

  if (!isReportKey(reportParam)) {
    notFound();
  }

  const report = reportParam;
  const meta = REPORT_META[report];

  const now = new Date();
  const monthStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
  const nowIso = now.toISOString();

  const scopeType = getFirstParam(rawSearchParams, "scopeType") ?? "all";
  const counterpartyId = getFirstParam(rawSearchParams, "counterpartyId") ?? "";
  const groupId = getFirstParam(rawSearchParams, "groupId") ?? "";
  const bookId = getFirstParam(rawSearchParams, "bookId") ?? "";
  const includeDescendants =
    getFirstParam(rawSearchParams, "includeDescendants") === "false"
      ? "false"
      : "true";
  const attributionMode =
    getFirstParam(rawSearchParams, "attributionMode") ??
    "analytic_counterparty";
  const includeUnattributed =
    getFirstParam(rawSearchParams, "includeUnattributed") === "true"
      ? "true"
      : "false";
  const currency = getFirstParam(rawSearchParams, "currency") ?? "";
  const from = getFirstParam(rawSearchParams, "from") ?? monthStartIso;
  const to = getFirstParam(rawSearchParams, "to") ?? nowIso;
  const asOf = getFirstParam(rawSearchParams, "asOf") ?? nowIso;
  const method = getFirstParam(rawSearchParams, "method") ?? "direct";
  const accountNo = getMultiParam(rawSearchParams, "accountNo");
  const status = getMultiParam(rawSearchParams, "status");
  const statuses = status.length > 0 ? status : ["posted"];
  const periodStart =
    getFirstParam(rawSearchParams, "periodStart") ?? monthStartIso;
  const page = Number(getFirstParam(rawSearchParams, "page") ?? "1");
  const perPage = Number(getFirstParam(rawSearchParams, "perPage") ?? "20");
  const normalizedPage =
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPerPage =
    Number.isFinite(perPage) && perPage > 0
      ? Math.min(Math.floor(perPage), 200)
      : 20;
  const offset = (normalizedPage - 1) * normalizedPerPage;

  const queryBase: Record<string, string | string[]> = {
    attributionMode,
    includeDescendants,
    includeUnattributed,
    scopeType,
    status: statuses,
  };

  if (counterpartyId) {
    queryBase.counterpartyId = [counterpartyId];
  }
  if (groupId) {
    queryBase.groupId = [groupId];
  }
  if (bookId) {
    queryBase.bookId = bookId
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (currency) {
    queryBase.currency = currency.toUpperCase();
  }

  let payload: Record<string, unknown> | null = null;
  let queryError: string | null = null;
  let requestQuery: Record<string, string | string[]> = {};

  try {
    switch (report) {
      case "trial-balance": {
        requestQuery = {
          ...queryBase,
          from,
          limit: String(normalizedPerPage),
          offset: String(offset),
          to,
        };
        payload = await getTrialBalance(requestQuery);
        break;
      }
      case "general-ledger": {
        requestQuery = {
          ...queryBase,
          accountNo: accountNo.length > 0 ? accountNo : ["1110"],
          from,
          limit: String(normalizedPerPage),
          offset: String(offset),
          to,
        };
        payload = await getGeneralLedger(requestQuery);
        break;
      }
      case "balance-sheet": {
        requestQuery = {
          ...queryBase,
          asOf,
        };
        payload = await getBalanceSheet(requestQuery);
        break;
      }
      case "income-statement": {
        requestQuery = {
          ...queryBase,
          from,
          to,
        };
        payload = await getIncomeStatement(requestQuery);
        break;
      }
      case "cash-flow": {
        requestQuery = {
          ...queryBase,
          from,
          method,
          to,
        };
        payload = await getCashFlow(requestQuery);
        break;
      }
      case "liquidity": {
        requestQuery = {
          ...queryBase,
          asOf,
          limit: String(normalizedPerPage),
          offset: String(offset),
        };
        payload = await getLiquidity(requestQuery);
        break;
      }
      case "fx-revaluation": {
        requestQuery = {
          ...queryBase,
          from,
          to,
        };
        payload = await getFxRevaluation(requestQuery);
        break;
      }
      case "fee-revenue": {
        requestQuery = {
          ...queryBase,
          from,
          limit: String(normalizedPerPage),
          offset: String(offset),
          to,
        };
        payload = await getFeeRevenue(requestQuery);
        break;
      }
      case "close-package": {
        if (!counterpartyId) {
          queryError = "Для пакета закрытия выберите контрагента.";
          break;
        }
        requestQuery = {
          counterpartyId,
          periodStart,
        };
        payload = await getClosePackage(requestQuery);
        break;
      }
    }
  } catch (error) {
    queryError = error instanceof Error ? error.message : String(error);
  }

  const csvParams = new URLSearchParams();
  for (const [key, value] of Object.entries(requestQuery)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        csvParams.append(key, item);
      }
      continue;
    }

    csvParams.set(key, value);
  }

  const csvHref = `/v1/accounting/reports/${report}/export${
    csvParams.size > 0 ? `?${csvParams.toString()}` : ""
  }`;

  const presentationContext = {
    accountNo,
    asOf,
    from,
    method,
    periodStart,
    to,
  };
  const overviewCards = buildReportOverviewCards(
    report,
    payload,
    presentationContext,
  );
  const sections = buildReportSections(report, payload, presentationContext);

  const total = typeof payload?.total === "number" ? payload.total : 0;
  const limit =
    typeof payload?.limit === "number" ? payload.limit : normalizedPerPage;
  const currentPage = normalizedPage;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0 rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="page" value="1" />
            <div className="grid gap-1">
              <label htmlFor="scopeType" className="text-sm font-medium">
                Тип области
              </label>
              <select
                id="scopeType"
                name="scopeType"
                defaultValue={scopeType}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="all">Все</option>
                <option value="counterparty">Контрагент</option>
                <option value="group">Группа</option>
                <option value="book">Книга</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="counterpartyId" className="text-sm font-medium">
                Контрагент
              </label>
              <select
                id="counterpartyId"
                name="counterpartyId"
                defaultValue={counterpartyId}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">Все</option>
                {orgOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="groupId" className="text-sm font-medium">
                Группа
              </label>
              <select
                id="groupId"
                name="groupId"
                defaultValue={groupId}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">Все</option>
                {groupOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="bookId" className="text-sm font-medium">
                ID книг (через запятую)
              </label>
              <input
                id="bookId"
                name="bookId"
                defaultValue={bookId}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label
                htmlFor="includeDescendants"
                className="text-sm font-medium"
              >
                Включая дочерние группы
              </label>
              <select
                id="includeDescendants"
                name="includeDescendants"
                defaultValue={includeDescendants}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="true">Да</option>
                <option value="false">Нет</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="attributionMode" className="text-sm font-medium">
                Режим атрибуции
              </label>
              <select
                id="attributionMode"
                name="attributionMode"
                defaultValue={attributionMode}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="analytic_counterparty">
                  Аналитика контрагента
                </option>
                <option value="book_org">Организация книги</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label
                htmlFor="includeUnattributed"
                className="text-sm font-medium"
              >
                Включать неатрибутированные
              </label>
              <select
                id="includeUnattributed"
                name="includeUnattributed"
                defaultValue={includeUnattributed}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="false">Нет</option>
                <option value="true">Да</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="currency" className="text-sm font-medium">
                Валюта
              </label>
              <input
                id="currency"
                name="currency"
                defaultValue={currency}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="from" className="text-sm font-medium">
                С (UTC)
              </label>
              <input
                id="from"
                name="from"
                defaultValue={from}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="to" className="text-sm font-medium">
                По (UTC)
              </label>
              <input
                id="to"
                name="to"
                defaultValue={to}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="asOf" className="text-sm font-medium">
                На дату (UTC)
              </label>
              <input
                id="asOf"
                name="asOf"
                defaultValue={asOf}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="periodStart" className="text-sm font-medium">
                Начало периода (пакет закрытия)
              </label>
              <input
                id="periodStart"
                name="periodStart"
                defaultValue={periodStart}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="method" className="text-sm font-medium">
                Метод ОДДС
              </label>
              <select
                id="method"
                name="method"
                defaultValue={method}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="direct">Прямой</option>
                <option value="indirect">Косвенный</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="accountNo" className="text-sm font-medium">
                Номера счетов (через запятую)
              </label>
              <input
                id="accountNo"
                name="accountNo"
                defaultValue={accountNo.join(",")}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="status" className="text-sm font-medium">
                Статусы (через запятую)
              </label>
              <input
                id="status"
                name="status"
                defaultValue={statuses.join(",")}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="perPage" className="text-sm font-medium">
                Строк на странице
              </label>
              <input
                id="perPage"
                name="perPage"
                defaultValue={String(normalizedPerPage)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="md:col-span-4 flex items-end gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                formMethod="get"
              >
                Применить фильтры
              </button>
              <Link
                href={csvHref}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                Экспорт CSV
              </Link>
              <Link
                href="/accounting/reports"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                Все отчеты
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {queryError ? (
        <Card className="min-w-0 rounded-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-base text-red-600">
              Ошибка запроса
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-sm">{queryError}</CardContent>
        </Card>
      ) : null}

      {!queryError ? <ReportOverviewCards cards={overviewCards} /> : null}

      {!queryError
        ? sections.map((section) => (
            <ReportSectionTable
              key={`${report}:${section.id}`}
              report={report}
              section={section}
            />
          ))
        : null}

      {total > 0 ? (
        <Card className="min-w-0 rounded-sm">
          <CardContent className="flex items-center justify-between pt-4">
            <p className="text-sm">
              Строк: {total} | Страница {currentPage} из {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildPageHref(
                  report,
                  rawSearchParams,
                  Math.max(1, currentPage - 1),
                )}
                className="border-input bg-background rounded-md border px-3 py-1 text-sm"
              >
                Назад
              </Link>
              <Link
                href={buildPageHref(
                  report,
                  rawSearchParams,
                  Math.min(totalPages, currentPage + 1),
                )}
                className="border-input bg-background rounded-md border px-3 py-1 text-sm"
              >
                Вперед
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
