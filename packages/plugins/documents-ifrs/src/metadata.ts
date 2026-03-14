import { IFRS_DOCUMENT_CATALOG } from "./definitions";
import type { IfrsDocumentMetadata, IfrsDocumentType } from "./types";

export { type IfrsDocumentFamily, type IfrsDocumentType } from "./types";

export const IFRS_DOCUMENT_TYPE_ORDER = IFRS_DOCUMENT_CATALOG
  .filter((entry) => entry.listed)
  .map((entry) => entry.docType) as readonly IfrsDocumentType[];

export const IFRS_DOCUMENT_METADATA = Object.freeze(
  Object.fromEntries(
    IFRS_DOCUMENT_CATALOG.map((entry) => [
      entry.docType,
      {
        docType: entry.docType,
        label: entry.label,
        family: entry.family,
        docNoPrefix: entry.docNoPrefix,
        creatable: entry.creatable,
        hasTypedForm: entry.hasTypedForm,
        adminOnly: entry.adminOnly,
      } satisfies IfrsDocumentMetadata,
    ]),
  ) as Record<IfrsDocumentType, IfrsDocumentMetadata>,
);
