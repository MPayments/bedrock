import Link from "next/link";
import { notFound } from "next/navigation";
import { FileType2 } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import {
  canCreateDocumentType,
  getDocumentTypeLabel,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { searchParamsCache } from "@/features/operations/documents/lib/validations";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ docType: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocumentTypePage({
  params,
  searchParams,
}: PageProps) {
  const { docType } = await params;

  if (!isKnownDocumentType(docType)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const typeScopedSearch = {
    ...parsedSearch,
    docType: [docType],
  };

  return (
    <EntityListPageShell
      icon={FileType2}
      title={`Документы типа ${getDocumentTypeLabel(docType)}`}
      description="Отдельная витрина документов по одному типу с общими фильтрами и действиями."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/documents" />}
          >
            Все документы
          </Button>
          {canCreateDocumentType(docType, session.role) ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/documents/create/${encodeURIComponent(docType)}`}
                />
              }
            >
              Создать этот тип
            </Button>
          ) : null}
        </div>
      }
      fallback={
        <DataTableSkeleton columnCount={7} rowCount={10} filterCount={5} />
      }
    >
      <DocumentsTable
        promise={getDocuments(typeScopedSearch)}
        routeBasePath="/documents"
      />
    </EntityListPageShell>
  );
}
