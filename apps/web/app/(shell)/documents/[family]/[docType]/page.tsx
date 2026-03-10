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
  getDocumentsWorkspaceFamilyLabel,
  isAllowedDocumentsWorkspaceType,
  isDocumentsWorkspaceFamily,
} from "@/features/documents/lib/doc-types";
import {
  buildDocumentCreateHref,
  buildDocumentsFamilyHref,
} from "@/features/documents/lib/routes";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { searchParamsCache } from "@/features/operations/documents/lib/validations";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ family: string; docType: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocumentTypePage({
  params,
  searchParams,
}: PageProps) {
  const { family, docType } = await params;

  if (!isDocumentsWorkspaceFamily(family)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  if (!isAllowedDocumentsWorkspaceType(docType, family, session.role)) {
    notFound();
  }

  const parsedSearch = await searchParamsCache.parse(searchParams);
  const typeScopedSearch = {
    ...parsedSearch,
    docType: [docType],
  };

  const createHref =
    canCreateDocumentType(docType, session.role) ?
      buildDocumentCreateHref(docType)
    : null;

  return (
    <EntityListPageShell
      icon={FileType2}
      title={`Документы типа ${getDocumentTypeLabel(docType)}`}
      description={`Семейство ${getDocumentsWorkspaceFamilyLabel(family)} с фильтрами только для этого типа.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={buildDocumentsFamilyHref(family)} />}
          >
            {getDocumentsWorkspaceFamilyLabel(family)}
          </Button>
          {createHref ? (
            <Button
              nativeButton={false}
              render={<Link href={createHref} />}
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
      <DocumentsTable promise={getDocuments(typeScopedSearch)} />
    </EntityListPageShell>
  );
}
