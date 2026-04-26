"use client";

import { DocumentCreateForm } from "@bedrock/sdk-documents-form-ui/components/document-create-form";
import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";

import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";
import {
  createDealScopedDocumentDraft,
  createDocumentDraft,
  updateDocumentDraft,
} from "@/features/operations/documents/lib/mutations";
import type { UserRole } from "@/lib/auth/types";

type DocumentCreateTypedFormClientProps = {
  dealId?: string;
  docType: string;
  initialPayload?: Record<string, unknown>;
  userRole: UserRole;
  options: DocumentFormOptions;
  reconciliationAdjustmentExceptionId?: string;
  successHref?: string;
};

export function DocumentCreateTypedFormClient({
  dealId,
  docType,
  initialPayload,
  userRole,
  options,
  reconciliationAdjustmentExceptionId,
  successHref,
}: DocumentCreateTypedFormClientProps) {
  return (
    <DocumentCreateForm
      dealId={dealId}
      docType={docType}
      docTypeLabel={getDocumentTypeLabel(docType)}
      initialPayload={initialPayload}
      isAdmin={userRole === "admin"}
      options={options}
      createMutator={async ({ docType: type, dealId: targetDealId, payload }) => {
        if (targetDealId) {
          return createDealScopedDocumentDraft({
            dealId: targetDealId,
            docType: type,
            payload,
          });
        }
        return createDocumentDraft({ docType: type, payload });
      }}
      updateMutator={async ({ docType: type, documentId, payload }) =>
        updateDocumentDraft({ docType: type, documentId, payload })
      }
      buildSuccessHref={({ docType: type, documentId }) =>
        buildDocumentDetailsHref(type, documentId, {
          reconciliationExceptionId: reconciliationAdjustmentExceptionId,
          returnTo: successHref,
        }) ??
        successHref ??
        "/documents"
      }
    />
  );
}
