import * as React from "react";
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

type OrganizationDocumentsPageContentProps = {
  organizationId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function OrganizationDocumentsPageContent({
  organizationId,
  searchParams,
}: OrganizationDocumentsPageContentProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const operations = await getOperations({
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
        <CardContent className="p-0">
          <OperationsJournalTable promise={Promise.resolve(operations)} />
        </CardContent>
      </Card>
    </div>
  );
}
