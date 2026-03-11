import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentCreateTypedFormClient } from "@/features/documents/components/document-create-typed-form-client";
import {
  canCreateDocumentType,
  getDocumentTypeLabel,
  isAllowedDocumentsWorkspaceType,
  isDocumentsWorkspaceFamily,
} from "@/features/documents/lib/doc-types";
import {
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
} from "@/features/documents/lib/form-options";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ family: string; docType: string }>;
}

export default async function DocumentCreateByTypePage({ params }: PageProps) {
  const { family, docType } = await params;

  if (!isDocumentsWorkspaceFamily(family)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  if (
    !isAllowedDocumentsWorkspaceType(docType, family, session.role) ||
    !canCreateDocumentType(docType, session.role)
  ) {
    notFound();
  }

  const options = await getDocumentFormOptions().catch(() =>
    createEmptyDocumentFormOptions(),
  );

  return (
    <EntityListPageShell
      icon={FilePlus2}
      title={`Создать ${getDocumentTypeLabel(docType)}`}
      description="Форма создания документа."
      fallback={null}
    >
      <DocumentCreateTypedFormClient
        docType={docType}
        userRole={session.role}
        options={options}
      />
    </EntityListPageShell>
  );
}
