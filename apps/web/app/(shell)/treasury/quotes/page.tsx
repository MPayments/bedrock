import * as React from "react";
import Link from "next/link";
import { TicketPercent } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import { FxQuotesTable } from "@/features/treasury/quotes/components/table";
import { getFxQuotes } from "@/features/treasury/quotes/lib/queries";
import {
  presentFxQuotesTableResult,
  resolveUsedFxDocumentArtifact,
} from "@/features/treasury/quotes/lib/presentation";
import { searchParamsCache } from "@/features/treasury/quotes/lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QuotesPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const quotes = await getFxQuotes(parsedSearch);
  const linkedDocumentIds = [
    ...new Set(
      quotes.data
        .map((quote) => resolveUsedFxDocumentArtifact(quote.usedByRef)?.documentId ?? null)
        .filter((documentId): documentId is string => Boolean(documentId)),
    ),
  ];
  const linkedDocuments = await Promise.all(
    linkedDocumentIds.map(async (documentId) => [
      documentId,
      await getDocumentDetails("fx_execute", documentId),
    ]),
  );
  const linkedDocumentsById = Object.fromEntries(linkedDocuments);
  const promise = Promise.resolve(
    presentFxQuotesTableResult({
      linkedDocumentsById,
      result: quotes,
    }),
  );

  return (
    <EntityListPageShell
      icon={TicketPercent}
      title="Котировки"
      description="Журнал FX-котировок со статусом, сроком действия и привязкой к документам."
      actions={
        <Button
          nativeButton={false}
          render={<Link href="/treasury/quotes/create" />}
          size="lg"
        >
          Новый FX
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={3} />}
    >
      <FxQuotesTable promise={promise} />
    </EntityListPageShell>
  );
}
