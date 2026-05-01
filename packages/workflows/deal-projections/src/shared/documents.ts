import type {
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";

import type { DealAttachmentRecord } from "./deps";

export function hasAttachmentPurpose(
  attachments: DealAttachmentRecord[],
  purpose: "contract" | "invoice",
  visibility?: "customer_safe" | "internal",
) {
  return attachments.some(
    (attachment) =>
      attachment.purpose === purpose &&
      (visibility ? attachment.visibility === visibility : true),
  );
}

export function hasCustomerSafeAttachment(
  attachments: DealAttachmentRecord[],
) {
  return attachments.some(
    (attachment) => attachment.visibility === "customer_safe",
  );
}

export function requiresExternalEvidence(type: DealType) {
  return type !== "currency_exchange";
}

export function isFormalDocumentReady(input: {
  approvalStatus: string | null;
  lifecycleStatus: string | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}) {
  return (
    input.lifecycleStatus === "active" &&
    input.submissionStatus === "submitted" &&
    (input.approvalStatus === "approved" ||
      input.approvalStatus === "not_required") &&
    (input.postingStatus === "posted" ||
      input.postingStatus === "not_required")
  );
}

export function findRelatedFormalDocument(input: {
  docType: string;
  invoicePurpose?: string | null;
  documents: DealWorkflowProjection["relatedResources"]["formalDocuments"];
}) {
  const matching = input.documents.filter((document) => {
    const documentInvoicePurpose =
      document.docType === "invoice"
        ? (document.invoicePurpose ?? "combined")
        : (document.invoicePurpose ?? null);

    return (
      document.docType === input.docType &&
      (input.invoicePurpose === undefined ||
        documentInvoicePurpose === input.invoicePurpose)
    );
  });

  return (
    matching.find((document) => document.lifecycleStatus === "active") ??
    matching.sort((left, right) => {
      const leftTime =
        left.createdAt?.getTime() ?? left.occurredAt?.getTime() ?? 0;
      const rightTime =
        right.createdAt?.getTime() ?? right.occurredAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0] ??
    null
  );
}
