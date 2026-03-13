import { COMMERCIAL_DOCUMENT_CATALOG } from "./definitions";
import type {
  CommercialDocumentCatalogEntry,
  CommercialDocumentDefinition,
} from "./definitions/types";
import {
  COMMERCIAL_DOCUMENT_METADATA,
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
} from "./metadata";
import type { CommercialDocumentType } from "./types";

export {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  FINANCIAL_LINE_BUCKETS,
  aggregateFinancialLines,
  financialLineBucketSchema,
  financialLineSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
  normalizeFinancialLine,
  type FinancialLine,
  type FinancialLineBucket,
  type FinancialLineSettlementMode,
  type FinancialLineSource,
} from "./financial-lines";
export {
  type CommercialDocumentDefinition,
  type DocumentFormBreakpoint,
  type DocumentFormDefinition,
  type DocumentFormField,
  type DocumentFormFieldOption,
  type DocumentFormResponsiveCount,
  type DocumentFormRow,
  type DocumentFormRowField,
  type DocumentFormSection,
  type DocumentFormSectionLayout,
  type DocumentFormValues,
} from "./definitions/types";
export {
  COMMERCIAL_DOCUMENT_TYPES,
  type CommercialDocumentFamily,
  type CommercialDocumentMetadata,
  type CommercialDocumentType,
} from "./types";
export * from "./validation";

export { COMMERCIAL_DOCUMENT_METADATA, COMMERCIAL_DOCUMENT_TYPE_ORDER };

export const COMMERCIAL_DOCUMENT_DEFINITIONS =
  COMMERCIAL_DOCUMENT_CATALOG as readonly CommercialDocumentCatalogEntry[];

const COMMERCIAL_DOCUMENT_DEFINITION_BY_TYPE = new Map(
  COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => [
    definition.docType,
    definition,
  ] as const),
);

export function getCommercialDocumentDefinition(docType: CommercialDocumentType) {
  return (
    COMMERCIAL_DOCUMENT_DEFINITION_BY_TYPE.get(docType) ??
    null
  ) as CommercialDocumentDefinition | null;
}
