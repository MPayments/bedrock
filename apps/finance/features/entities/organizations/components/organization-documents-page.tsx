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

type OrganizationDocumentsPageContentProps = {
  organizationId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function OrganizationDocumentsPageContent({
  organizationId,
  searchParams,
}: OrganizationDocumentsPageContentProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  let operations: Awaited<ReturnType<typeof getOperations>> | null = null;
  let operationsError: string | null = null;

  try {
    operations = await getOperations({
      ...parsedSearch,
      dimensionFilters: {
        ...parsedSearch.dimensionFilters,
        organizationId: Array.from(
          new Set([
            ...(parsedSearch.dimensionFilters?.organizationId ?? []),
            organizationId,
          ]),
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
          <CardTitle>Документы организации</CardTitle>
          <CardDescription>
            Документы и связанные проводки ledger, относящиеся к текущей
            организации.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">
            Отображаются документы и операции с фильтром{" "}
            <code>dimension.organizationId={organizationId}</code> по аналитике
            проводок. Для полного журнала откройте{" "}
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
              Не удалось загрузить журнал операций по организации.
              {operationsError ? ` ${operationsError}` : ""}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
