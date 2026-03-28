import * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, TicketPercent } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { FxExecutePayloadSchema } from "@bedrock/plugin-documents-ifrs/validation";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { SectionPlaceholderPage } from "@/components/section-placeholder-page";
import { FxQuoteDetail } from "@/features/treasury/quotes/components/quote-detail";
import { getRequisiteById } from "@/features/entities/requisites/lib/queries";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import {
  presentLinkedFxDocumentArtifact,
} from "@/features/treasury/quotes/lib/detail-presentation";
import { getFxQuoteDetails } from "@/features/treasury/quotes/lib/queries";
import {
  presentFxQuoteDetail,
  resolveUsedFxDocumentArtifact,
} from "@/features/treasury/quotes/lib/presentation";
import { presentFxQuoteStage } from "@/features/treasury/quotes/lib/stage";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";

type QuoteDetailPageProps = {
  params: Promise<{ quoteRef: string }>;
};

export default async function TreasuryQuoteDetailPage({
  params,
}: QuoteDetailPageProps) {
  const { quoteRef } = await params;
  const details = await getFxQuoteDetails(quoteRef);

  if (!details) {
    notFound();
  }

  const artifact = resolveUsedFxDocumentArtifact(details.quote.usedByRef);
  const linkedDocumentDetails = artifact
    ? await getDocumentDetails("fx_execute", artifact.documentId)
    : null;
  const parsedFxPayload =
    linkedDocumentDetails &&
    FxExecutePayloadSchema.safeParse(linkedDocumentDetails.document.payload);

  const [references, sourceRequisite, destinationRequisite] =
    parsedFxPayload && parsedFxPayload.success
      ? await Promise.all([
          getTreasuryReferenceData(),
          getRequisiteById(parsedFxPayload.data.sourceRequisiteId),
          getRequisiteById(parsedFxPayload.data.destinationRequisiteId),
        ])
      : [null, null, null];

  const view = presentFxQuoteDetail(details);
  const stage = presentFxQuoteStage({
    quote: details.quote,
    linkedDocument: linkedDocumentDetails,
  });
  const linkedFxDocument = presentLinkedFxDocumentArtifact({
    details: linkedDocumentDetails,
    organizationLabels: references?.organizationLabels ?? {},
    sourceRequisiteLabel: sourceRequisite?.label ?? null,
    destinationRequisiteLabel: destinationRequisite?.label ?? null,
  });

  return (
    <EntityListPageShell
      icon={TicketPercent}
      title={view.header.title}
      description={view.header.summary}
      actions={
        <Button
          nativeButton={false}
          render={<Link href="/treasury/quotes/create" />}
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Новый FX
        </Button>
      }
      fallback={<SectionPlaceholderPage title="Загрузка котировки" />}
    >
      <FxQuoteDetail
        details={details}
        stage={stage}
        linkedFxDocument={linkedFxDocument}
      />
    </EntityListPageShell>
  );
}
