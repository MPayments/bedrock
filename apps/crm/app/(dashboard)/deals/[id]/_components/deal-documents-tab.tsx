import { AttachmentsCard } from "./attachments-card";
import { BeneficiaryDraftCard } from "./beneficiary-draft-card";
import { EvidenceRequirementsCard } from "./evidence-requirements-card";
import { FormalDocumentsCard } from "./formal-documents-card";
import type { ApiAttachment, ApiCrmDealWorkbenchProjection, ApiFormalDocument } from "./types";

type DealDocumentsTabProps = {
  attachments: ApiAttachment[];
  attachmentIngestions: ApiCrmDealWorkbenchProjection["workflow"]["attachmentIngestions"];
  beneficiaryDraft: ApiCrmDealWorkbenchProjection["beneficiaryDraft"];
  dealId: string;
  deletingAttachmentId: string | null;
  documentRequirements: ApiCrmDealWorkbenchProjection["documentRequirements"];
  evidenceRequirements: ApiCrmDealWorkbenchProjection["evidenceRequirements"];
  formalDocuments: ApiFormalDocument[];
  reingestingAttachmentId: string | null;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentReingest: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
};

export function DealDocumentsTab({
  attachments,
  attachmentIngestions,
  beneficiaryDraft,
  dealId,
  deletingAttachmentId,
  documentRequirements,
  evidenceRequirements,
  formalDocuments,
  reingestingAttachmentId,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentReingest,
  onAttachmentUpload,
}: DealDocumentsTabProps) {
  const showsBeneficiaryDraft = evidenceRequirements.some(
    (requirement) => requirement.code === "invoice" || requirement.code === "contract",
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <EvidenceRequirementsCard requirements={evidenceRequirements} />
        {showsBeneficiaryDraft ? (
          <BeneficiaryDraftCard beneficiaryDraft={beneficiaryDraft} />
        ) : null}
        <AttachmentsCard
          attachments={attachments}
          attachmentIngestions={attachmentIngestions}
          deletingAttachmentId={deletingAttachmentId}
          onDelete={onAttachmentDelete}
          onDownload={onAttachmentDownload}
          onReingest={onAttachmentReingest}
          onUpload={onAttachmentUpload}
          reingestingAttachmentId={reingestingAttachmentId}
        />
      </section>

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
