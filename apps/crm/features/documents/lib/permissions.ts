import type { DocumentTransitionMutators } from "@bedrock/sdk-documents-form-ui/lib/mutations";

import {
  cancelDocument,
  postDocument,
  submitDocument,
} from "./mutations";

/**
 * CRM dealer's narrow set of actions on commercial documents.
 * approve/reject/repost are back-office actions — not exposed to dealers.
 */
export function buildCrmDocumentMutators(): DocumentTransitionMutators {
  return {
    submit: ({ docType, documentId }) =>
      submitDocument({ docType, documentId }),
    post: ({ docType, documentId }) =>
      postDocument({ docType, documentId }),
    cancel: ({ docType, documentId }) =>
      cancelDocument({ docType, documentId }),
  };
}
