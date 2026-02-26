import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Separator } from "@bedrock/ui/components/separator";

import { TransfersPageClient } from "./components/transfers-page-client";
import { getTransferFormOptions, getTransfers } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
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

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  params.set("page", String(page));
  return `/operations/transfers?${params.toString()}`;
}

export default async function OperationsTransfersPage({
  searchParams,
}: PageProps) {
  const rawSearchParams = await searchParams;
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const [transfers, formOptions] = await Promise.all([
    getTransfers(parsedSearch),
    getTransferFormOptions(),
  ]);

  const currentPage = parsedSearch.page ?? 1;
  const pageSize = parsedSearch.perPage ?? transfers.limit;
  const totalPages = Math.max(1, Math.ceil(transfers.total / pageSize));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <ArrowRightLeft className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Операции переводов</h3>
          <p className="text-muted-foreground text-sm">
            Черновики, approve/reject, pending settle/void и связь с ledger
            operation.
          </p>
        </div>
      </div>
      <Separator className="h-px w-full" />

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>
            Фильтрация списка переводов по статусу и типу.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="grid gap-3 md:grid-cols-4">
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
                <option value="draft">draft</option>
                <option value="approved_pending_posting">
                  approved_pending_posting
                </option>
                <option value="pending">pending</option>
                <option value="settle_pending_posting">
                  settle_pending_posting
                </option>
                <option value="void_pending_posting">
                  void_pending_posting
                </option>
                <option value="posted">posted</option>
                <option value="voided">voided</option>
                <option value="rejected">rejected</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="kind">
                Kind
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={
                  Array.isArray(rawSearchParams.kind)
                    ? rawSearchParams.kind[0]
                    : (rawSearchParams.kind ?? "")
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">All</option>
                <option value="intra_org">intra_org</option>
                <option value="cross_org">cross_org</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="settlementMode">
                Settlement mode
              </label>
              <select
                id="settlementMode"
                name="settlementMode"
                defaultValue={
                  Array.isArray(rawSearchParams.settlementMode)
                    ? rawSearchParams.settlementMode[0]
                    : (rawSearchParams.settlementMode ?? "")
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">All</option>
                <option value="immediate">immediate</option>
                <option value="pending">pending</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm"
              >
                Применить
              </button>
              <Link
                href="/operations/transfers"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm leading-9"
              >
                Сброс
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <TransfersPageClient
        transfers={transfers.data}
        formOptions={formOptions}
      />

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Всего: {transfers.total}. Страница {currentPage} из {totalPages}
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
