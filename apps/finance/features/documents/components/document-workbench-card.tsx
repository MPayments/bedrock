"use client";

import { DocumentWorkbenchCard as SharedDocumentWorkbenchCard } from "@bedrock/sdk-documents-form-ui/components/document-workbench-card";
import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";

import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import {
  createDealScopedDocumentDraft,
  createDocumentDraft,
  updateDocumentDraft,
} from "@/features/operations/documents/lib/mutations";
import type { UserRole } from "@/lib/auth/types";

type DocumentWorkbenchCardProps = {
  docType: string;
  documentId: string;
  payload: Record<string, unknown>;
  allowedActions: string[];
  userRole: UserRole;
  options: DocumentFormOptions;
};

export function DocumentWorkbenchCard({
  allowedActions,
  docType,
  documentId,
  options,
  payload,
  userRole,
}: DocumentWorkbenchCardProps) {
  return (
    <SharedDocumentWorkbenchCard
      docType={docType}
      docTypeLabel={getDocumentTypeLabel(docType)}
      documentId={documentId}
      payload={payload}
      allowedActions={allowedActions}
      isAdmin={userRole === "admin"}
      options={options}
      createMutator={async ({ docType: type, dealId, payload: input }) => {
        if (dealId) {
          return createDealScopedDocumentDraft({
            dealId,
            docType: type,
            payload: input,
          });
        }
        return createDocumentDraft({ docType: type, payload: input });
      }}
      updateMutator={async ({ docType: type, documentId: id, payload: input }) =>
        updateDocumentDraft({
          docType: type,
          documentId: id,
          payload: input,
        })
      }
    />
  );
}
