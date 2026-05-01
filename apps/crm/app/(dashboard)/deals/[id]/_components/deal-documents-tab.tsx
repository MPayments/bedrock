import { FormalDocumentsCard } from "./formal-documents-card";
import type { ApiCrmDealWorkbenchProjection, ApiFormalDocument } from "./types";

type DealDocumentsTabProps = {
  dealId: string;
  documentRequirements: ApiCrmDealWorkbenchProjection["documentRequirements"];
  formalDocuments: ApiFormalDocument[];
};

export function DealDocumentsTab({
  dealId,
  documentRequirements,
  formalDocuments,
}: DealDocumentsTabProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <FormalDocumentsCard
          dealId={dealId}
          documents={formalDocuments}
          requirements={documentRequirements}
        />
      </section>
    </div>
  );
}
