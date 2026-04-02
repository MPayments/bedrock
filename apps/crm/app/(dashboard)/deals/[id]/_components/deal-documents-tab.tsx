import { FileText, Paperclip } from "lucide-react";

import { AttachmentsCard } from "./attachments-card";
import { EvidenceRequirementsCard } from "./evidence-requirements-card";
import { FormalDocumentsCard } from "./formal-documents-card";
import type { ApiAttachment, ApiCrmDealWorkbenchProjection, ApiFormalDocument } from "./types";

type DealDocumentsTabProps = {
  attachments: ApiAttachment[];
  deletingAttachmentId: string | null;
  documentRequirements: ApiCrmDealWorkbenchProjection["documentRequirements"];
  evidenceRequirements: ApiCrmDealWorkbenchProjection["evidenceRequirements"];
  formalDocuments: ApiFormalDocument[];
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
};

export function DealDocumentsTab({
  attachments,
  deletingAttachmentId,
  documentRequirements,
  evidenceRequirements,
  formalDocuments,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentUpload,
}: DealDocumentsTabProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <EvidenceRequirementsCard requirements={evidenceRequirements} />
        <AttachmentsCard
          attachments={attachments}
          deletingAttachmentId={deletingAttachmentId}
          onDelete={onAttachmentDelete}
          onDownload={onAttachmentDownload}
          onUpload={onAttachmentUpload}
        />
      </section>

      <section className="space-y-4">
        <FormalDocumentsCard
          documents={formalDocuments}
          requirements={documentRequirements}
        />
      </section>
    </div>
  );
}
