import { AttachmentsCard } from "./attachments-card";
import { BeneficiaryDraftCard } from "./beneficiary-draft-card";
import { EvidenceRequirementsCard } from "./evidence-requirements-card";
import { FormalDocumentsCard } from "./formal-documents-card";
import type { ApiCrmDealWorkbenchProjection } from "./types";

type DealDocumentsTabProps = {
  deletingAttachmentId: string | null;
  reingestingAttachmentId: string | null;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentReingest: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
  workbench: ApiCrmDealWorkbenchProjection;
};

export function DealDocumentsTab({
  deletingAttachmentId,
  reingestingAttachmentId,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentReingest,
  onAttachmentUpload,
  workbench,
}: DealDocumentsTabProps) {
  const { beneficiaryDraft, documentRequirements, evidenceRequirements } =
    workbench;
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
          attachments={workbench.relatedResources.attachments}
          attachmentIngestions={workbench.attachmentIngestions}
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
          documents={workbench.relatedResources.formalDocuments}
          requirements={documentRequirements}
        />
      </section>
    </div>
  );
}
