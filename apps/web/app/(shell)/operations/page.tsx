import { FileText } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentsTable } from "@/components/documents/documents-table";

import { getDocuments } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OperationsPage({ searchParams }: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const documentsPromise = getDocuments(parsedSearch);

  return (
    <EntityListPageShell
      icon={FileText}
      title="Документы"
      description="Единый журнал документов, статусов и связанных ledger операций."
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={5} />}
    >
      <DocumentsTable promise={documentsPromise} />
    </EntityListPageShell>
  );
}
