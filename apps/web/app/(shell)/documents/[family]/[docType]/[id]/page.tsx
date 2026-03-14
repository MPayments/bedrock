import { notFound } from "next/navigation";

import { DocumentDetailsView } from "@/features/documents/components/document-details-view";
import {
  isAllowedDocumentsWorkspaceType,
  isDocumentsWorkspaceFamily,
} from "@/features/documents/lib/doc-types";
import {
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
} from "@/features/documents/lib/form-options";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import { getOperationById } from "@/features/operations/journal/lib/queries";
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

  const detailsPromise = getDocumentDetails(docType, id);
  const formOptionsPromise = getDocumentFormOptions().catch(() =>
    createEmptyDocumentFormOptions(),
  );
  const details = await detailsPromise;

  if (!details) {
    notFound();
  }

  const operationIds = Array.from(
    new Set(details.documentOperations.map((operation) => operation.operationId)),
  );
  const journalOperationsPromise = Promise.all(
    operationIds.map(async (operationId) => [
      operationId,
      await getOperationById(operationId),
    ] as const),
  );
  const [formOptions, journalOperationsEntries] = await Promise.all([
    formOptionsPromise,
    journalOperationsPromise,
  ]);
  const journalOperations = Object.fromEntries(journalOperationsEntries);

  return (
    <DocumentDetailsView
      details={details}
      documentBasePath={`/documents/${family}`}
      journalOperations={journalOperations}
      userRole={session.role}
      formOptions={formOptions}
    />
  );
}
