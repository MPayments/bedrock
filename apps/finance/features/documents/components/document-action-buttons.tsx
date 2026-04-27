"use client";

import { DocumentActionButtons as SharedDocumentActionButtons } from "@bedrock/sdk-documents-form-ui/components/document-action-buttons";
import type { DocumentTransitionMutators } from "@bedrock/sdk-documents-form-ui/lib/mutations";
import { useRouter } from "next/navigation";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  approveDocument,
  postDocument,
  rejectDocument,
  repostDocument,
  resolveDealReconciliationExceptionWithAdjustmentDocument,
  submitDocument,
  voidDocument,
} from "@/features/operations/documents/lib/mutations";

type DocumentActionButtonsProps = {
  docType: string;
  documentId: string;
  allowedActions: string[];
  reconciliationAdjustment?: {
    dealId: string;
    exceptionId: string;
    returnToHref?: string;
  };
  returnOnPostedHref?: string;
};

export function DocumentActionButtons({
  docType,
  documentId,
  allowedActions,
  reconciliationAdjustment,
  returnOnPostedHref,
}: DocumentActionButtonsProps) {
  const router = useRouter();

  const mutators: DocumentTransitionMutators = {
    submit: ({ docType: type, documentId: id }) =>
      submitDocument({ docType: type, documentId: id }),
    approve: ({ docType: type, documentId: id }) =>
      approveDocument({ docType: type, documentId: id }),
    reject: ({ docType: type, documentId: id }) =>
      rejectDocument({ docType: type, documentId: id }),
    post: ({ docType: type, documentId: id }) =>
      postDocument({ docType: type, documentId: id }),
    cancel: ({ docType: type, documentId: id }) =>
      voidDocument({ docType: type, documentId: id }),
    repost: ({ docType: type, documentId: id }) =>
      repostDocument({ docType: type, documentId: id }),
  };

  return (
    <SharedDocumentActionButtons
      docType={docType}
      documentId={documentId}
      allowedActions={allowedActions}
      mutators={mutators}
      returnOnPostedHref={
        reconciliationAdjustment ? undefined : returnOnPostedHref
      }
      onPostedSuccess={
        reconciliationAdjustment
          ? async () => {
              const resolution =
                await resolveDealReconciliationExceptionWithAdjustmentDocument({
                  dealId: reconciliationAdjustment.dealId,
                  docType,
                  documentId,
                  exceptionId: reconciliationAdjustment.exceptionId,
                });

              if (!resolution.ok) {
                toast.error(resolution.message);
                router.refresh();
                return;
              }

              toast.success("Документ проведен, исключение сверки разрешено");

              if (reconciliationAdjustment.returnToHref) {
                router.push(reconciliationAdjustment.returnToHref);
                return;
              }

              router.refresh();
            }
          : undefined
      }
    />
  );
}
