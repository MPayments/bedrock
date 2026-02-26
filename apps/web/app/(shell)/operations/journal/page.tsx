import Link from "next/link";
import { BookOpen } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Separator } from "@bedrock/ui/components/separator";

import { OperationsJournalTable } from "./components/operations-journal-table";
import { getOperations } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface OperationsJournalPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  return `/operations/journal?${params.toString()}`;
}

export default async function OperationsJournalPage({
  searchParams,
}: OperationsJournalPageProps) {
  const rawSearchParams = await searchParams;
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const operations = await getOperations(parsedSearch);

  const currentPage = parsedSearch.page ?? 1;
  const pageSize = parsedSearch.perPage ?? operations.limit;
  const totalPages = Math.max(1, Math.ceil(operations.total / pageSize));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <BookOpen className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Журнал операций</h3>
          <p className="text-muted-foreground text-sm">
            Операции ledger и детали проводок по шаблонам accounting engine.
          </p>
        </div>
      </div>
      <Separator className="h-px w-full" />

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Фильтрация по статусу, source и operation code.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="grid gap-3 md:grid-cols-5">
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={
                  Array.isArray(rawSearchParams.status)
                    ? rawSearchParams.status[0]
                    : (rawSearchParams.status ?? "")
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="posted">posted</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="sourceType">
                Source type
              </label>
              <input
                id="sourceType"
                name="sourceType"
                defaultValue={
                  Array.isArray(rawSearchParams.sourceType)
                    ? rawSearchParams.sourceType[0]
                    : (rawSearchParams.sourceType ?? "")
                }
                placeholder="transfer/v3/approve"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="operationCode">
                Operation code
              </label>
              <input
                id="operationCode"
                name="operationCode"
                defaultValue={
                  Array.isArray(rawSearchParams.operationCode)
                    ? rawSearchParams.operationCode[0]
                    : (rawSearchParams.operationCode ?? "")
                }
                placeholder="TRANSFER_APPROVE_IMMEDIATE_INTRA"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="sourceId">
                Source ID
              </label>
              <input
                id="sourceId"
                name="sourceId"
                defaultValue={
                  typeof rawSearchParams.sourceId === "string"
                    ? rawSearchParams.sourceId
                    : ""
                }
                placeholder="UUID"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="bookOrgId">
                Book org ID
              </label>
              <input
                id="bookOrgId"
                name="bookOrgId"
                defaultValue={
                  typeof rawSearchParams.bookOrgId === "string"
                    ? rawSearchParams.bookOrgId
                    : ""
                }
                placeholder="UUID"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-5">
              <button
                type="submit"
                className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm"
              >
                Применить
              </button>
              <Link
                href="/operations/journal"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm leading-9"
              >
                Сброс
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardContent className="p-0">
          <OperationsJournalTable operations={operations.data} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Всего: {operations.total}. Страница {currentPage} из {totalPages}
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
