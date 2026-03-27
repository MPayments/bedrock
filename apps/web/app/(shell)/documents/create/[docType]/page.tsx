import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentCreateTypedFormClient } from "@/features/documents/components/document-create-typed-form-client";
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
import {
  canCreateDocumentType,
  getDocumentTypeLabel,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import {
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
} from "@/features/documents/lib/form-options";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ docType: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function resolveCreateInitialValues(
  docType: string,
  searchParams: Record<string, string | string[] | undefined>,
): DocumentFormValues | undefined {
  if (docType !== "payment_order") {
    return undefined;
  }

  const initialValues = {
    contour: readSearchParam(searchParams, "contour") ?? undefined,
    incomingInvoiceDocumentId:
      readSearchParam(searchParams, "incomingInvoiceDocumentId") ?? undefined,
    sourcePaymentOrderDocumentId:
      readSearchParam(searchParams, "sourcePaymentOrderDocumentId") ?? undefined,
    counterpartyId: readSearchParam(searchParams, "counterpartyId") ?? undefined,
    counterpartyRequisiteId:
      readSearchParam(searchParams, "counterpartyRequisiteId") ?? undefined,
    organizationId: readSearchParam(searchParams, "organizationId") ?? undefined,
    organizationRequisiteId:
      readSearchParam(searchParams, "organizationRequisiteId") ?? undefined,
    amount: readSearchParam(searchParams, "amount") ?? undefined,
    currency: readSearchParam(searchParams, "currency") ?? undefined,
    allocatedCurrency:
      readSearchParam(searchParams, "allocatedCurrency") ?? undefined,
    executionStatus:
      readSearchParam(searchParams, "executionStatus") ?? undefined,
    executionRef: readSearchParam(searchParams, "executionRef") ?? undefined,
  } satisfies DocumentFormValues;

  return Object.values(initialValues).some(Boolean) ? initialValues : undefined;
}

export default async function DocumentCreateByTypePage({
  params,
  searchParams,
}: PageProps) {
  const { docType } = await params;
  const resolvedSearchParams = await searchParams;

  if (!isKnownDocumentType(docType)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  if (!canCreateDocumentType(docType, session.role)) {
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
        initialValues={resolveCreateInitialValues(docType, resolvedSearchParams)}
      />
    </EntityListPageShell>
  );
}
