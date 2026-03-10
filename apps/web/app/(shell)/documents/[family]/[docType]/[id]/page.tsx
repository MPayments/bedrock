import { notFound } from "next/navigation";

import { DocumentDetailsView } from "@/features/documents/components/document-details-view";
import {
  isAllowedDocumentsWorkspaceType,
  isDocumentsWorkspaceFamily,
} from "@/features/documents/lib/doc-types";
import { getDocumentFormOptions } from "@/features/documents/lib/form-options";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ family: string; docType: string; id: string }>;
}

export default async function DocumentsDetailsPage({ params }: PageProps) {
  const { family, docType, id } = await params;

  if (!isDocumentsWorkspaceFamily(family)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  if (!isAllowedDocumentsWorkspaceType(docType, family, session.role)) {
    notFound();
  }

  const [details, formOptions] = await Promise.all([
    getDocumentDetails(docType, id),
    getDocumentFormOptions().catch(() => ({
      counterparties: [],
      organizations: [],
      currencies: [],
    })),
  ]);

  if (!details) {
    notFound();
  }

  return (
    <DocumentDetailsView
      details={details}
      userRole={session.role}
      formOptions={formOptions}
    />
  );
}
