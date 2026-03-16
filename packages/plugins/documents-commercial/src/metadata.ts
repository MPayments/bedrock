import { COMMERCIAL_DOCUMENT_CATALOG } from "./definitions";
import type {
  CommercialDocumentMetadata,
  CommercialDocumentType,
} from "./types";

export { type CommercialDocumentFamily, type CommercialDocumentType } from "./types";

export const COMMERCIAL_DOCUMENT_TYPE_ORDER = COMMERCIAL_DOCUMENT_CATALOG
  .filter((entry) => entry.listed)
  .map((entry) => entry.docType) as readonly CommercialDocumentType[];

export const COMMERCIAL_DOCUMENT_METADATA = Object.freeze(
  Object.fromEntries(
    COMMERCIAL_DOCUMENT_CATALOG.map((entry) => [
      entry.docType,
      {
        docType: entry.docType,
        label: entry.label,
        family: entry.family,
        docNoPrefix: entry.docNoPrefix,
        creatable: entry.creatable,
        hasTypedForm: entry.hasTypedForm,
        adminOnly: entry.adminOnly,
      } satisfies CommercialDocumentMetadata,
    ]),
  ) as Record<CommercialDocumentType, CommercialDocumentMetadata>,
);
