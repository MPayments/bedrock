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
import { normalizeInternalReturnToPath } from "@/features/documents/lib/routes";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { isUuid } from "@/lib/resources/http";

interface PageProps {
  params: Promise<{ family: string; docType: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getFirstSearchParamValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

export default async function DocumentsDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ family, docType, id }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

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
  const [details, formOptions] = await Promise.all([
    detailsPromise,
    formOptionsPromise,
  ]);
  const requestedReturnTo = normalizeInternalReturnToPath(
    getFirstSearchParamValue(rawSearchParams.returnTo),
  );
  const rawReconciliationExceptionId = getFirstSearchParamValue(
    rawSearchParams.reconciliationExceptionId,
  );
  const reconciliationAdjustmentExceptionId =
    rawReconciliationExceptionId && isUuid(rawReconciliationExceptionId)
      ? rawReconciliationExceptionId
      : null;

  if (!details) {
    notFound();
  }

  return (
    <DocumentDetailsView
      details={details}
      dealId={details.document.dealId}
      documentBasePath={`/documents/${family}`}
      userRole={session.role}
      formOptions={formOptions}
      reconciliationAdjustmentExceptionId={
        reconciliationAdjustmentExceptionId ?? undefined
      }
      returnToHref={requestedReturnTo ?? undefined}
    />
  );
}
