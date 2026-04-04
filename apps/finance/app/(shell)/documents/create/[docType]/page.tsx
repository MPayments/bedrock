import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { getAgreementContextById } from "@/features/agreements/lib/queries";
import { DocumentCreateTypedFormClient } from "@/features/documents/components/document-create-typed-form-client";
import {
  canCreateDocumentType,
  getDocumentTypeLabel,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";
import { buildDealScopedDocumentInitialPayload } from "@/features/documents/lib/deal-prefill";
import {
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
} from "@/features/documents/lib/form-options";
import {
  buildDealDocumentsTabHref,
  normalizeInternalReturnToPath,
} from "@/features/documents/lib/routes";
import { getFinanceDealWorkbenchById } from "@/features/treasury/deals/lib/queries";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { isUuid } from "@/lib/resources/http";

interface PageProps {
  params: Promise<{ docType: string }>;
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

export default async function DocumentCreateByTypePage({
  params,
  searchParams,
}: PageProps) {
  const [{ docType }, rawSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getServerSessionSnapshot(),
  ]);

  if (!isKnownDocumentType(docType)) {
    notFound();
  }

  if (!canCreateDocumentType(docType, session.role)) {
    notFound();
  }

  const rawDealId = getFirstSearchParamValue(rawSearchParams.dealId);
  const dealId = rawDealId && isUuid(rawDealId) ? rawDealId : null;
  const requestedReturnTo = normalizeInternalReturnToPath(
    getFirstSearchParamValue(rawSearchParams.returnTo),
  );

  const [options, deal] = await Promise.all([
    getDocumentFormOptions().catch(() => createEmptyDocumentFormOptions()),
    dealId ? getFinanceDealWorkbenchById(dealId) : Promise.resolve(null),
  ]);

  if (dealId && !deal) {
    notFound();
  }

  const successHref = dealId
    ? requestedReturnTo ?? buildDealDocumentsTabHref(dealId)
    : undefined;
  const agreement =
    deal && docType === "invoice" && deal.workflow?.summary.agreementId
      ? await getAgreementContextById(deal.workflow.summary.agreementId).catch(
          () => null,
        )
      : null;
  const initialPayload = deal
    ? buildDealScopedDocumentInitialPayload({
        agreement,
        deal,
        docType,
        options,
      })
    : undefined;

  return (
    <EntityListPageShell
      icon={FilePlus2}
      title={`Создать ${getDocumentTypeLabel(docType)}`}
      description="Форма создания документа."
      fallback={null}
    >
      <DocumentCreateTypedFormClient
        dealId={dealId ?? undefined}
        docType={docType}
        initialPayload={initialPayload}
        userRole={session.role}
        options={options}
        successHref={successHref}
      />
    </EntityListPageShell>
  );
}
