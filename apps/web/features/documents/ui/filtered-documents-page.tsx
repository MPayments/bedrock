import { FileText, type LucideIcon } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { DocumentsTable } from "@/components/documents/documents-table";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { getDocuments } from "@/app/(shell)/operations/lib/queries";
import type { OperationsSearchParams } from "@/app/(shell)/operations/lib/validations";

export async function FilteredDocumentsPage({
  title,
  description,
  docTypes,
  search,
  icon = FileText,
}: {
  title: string;
  description: string;
  docTypes: string[];
  search: OperationsSearchParams;
  icon?: LucideIcon;
}) {
  const documentsPromise = getDocuments({
    ...search,
    docType: docTypes,
  });

  return (
    <EntityListPageShell
      icon={icon}
      title={title}
      description={description}
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />}
    >
      <DocumentsTable promise={documentsPromise} />
    </EntityListPageShell>
  );
}
