import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { OperationsJournalTable } from "@/features/operations/journal/components/operations-journal-table";
import { getOperations } from "@/features/operations/journal/lib/queries";
import { searchParamsCache } from "@/features/operations/journal/lib/validations";
import { isApiRequestError } from "@/lib/api/query";

interface CounterpartyDocumentsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CounterpartyDocumentsPage({
  params,
  searchParams,
}: CounterpartyDocumentsPageProps) {
  const { id } = await params;
  const parsedSearch = await searchParamsCache.parse(searchParams);
  let operations: Awaited<ReturnType<typeof getOperations>> | null = null;
  let operationsError: string | null = null;

  try {
    operations = await getOperations({
      ...parsedSearch,
      dimensionFilters: {
        ...parsedSearch.dimensionFilters,
        counterpartyId: Array.from(
          new Set([...(parsedSearch.dimensionFilters?.counterpartyId ?? []), id]),
        ),
      },
    });
  } catch (error) {
    if (!isApiRequestError(error)) {
      throw error;
    }

    operationsError = error.message;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Документы контрагента</CardTitle>
          <CardDescription>
            Документы и связанные проводки ledger, где книга принадлежит
            текущему контрагенту.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">
            Отображаются документы и операции с фильтром{" "}
            <code>dimension.counterpartyId={id}</code> по аналитике проводок.
            Для полного журнала откройте{" "}
            <Link href="/documents/journal" className="underline">
              глобальный журнал операций
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        {operations ? (
          <CardContent className="p-0">
            <OperationsJournalTable promise={Promise.resolve(operations)} />
          </CardContent>
        ) : (
          <CardContent className="pt-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Не удалось загрузить журнал операций по контрагенту.
              {operationsError ? ` ${operationsError}` : ""}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
