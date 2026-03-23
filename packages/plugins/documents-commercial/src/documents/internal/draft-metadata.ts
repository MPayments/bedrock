import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";

export function requireDraftMetadata(input: {
  draft: { docNo: string; docType: string } | null;
}) {
  if (!input.draft) {
    throw new DocumentValidationError("Draft metadata is required");
  }

  return input.draft;
}
