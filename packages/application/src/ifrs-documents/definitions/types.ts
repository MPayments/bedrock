import type { z } from "zod";

import type { DocumentModule } from "@bedrock/application/documents";

import type { IfrsModuleDeps } from "../documents/internal/types";
import type { IfrsDocumentFamily, IfrsDocumentType } from "../types";

export interface DocumentFormFieldOption {
  value: string;
  label: string;
}

interface DocumentFormFieldBase {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  hidden?: boolean;
  deriveFrom?: {
    kind: "accountCurrency";
    accountFieldNames: string[];
  };
}

type DocumentFormOwnerOptionsSource = "counterparties" | "organizations";
type DocumentFormRequisiteOptionsSource =
  | "counterpartyRequisites"
  | "organizationRequisites";

type DocumentFormFieldInput =
  | (DocumentFormFieldBase & {
      kind: "datetime" | "date" | "month" | "text" | "amount";
    })
  | (DocumentFormFieldBase & {
      kind: "textarea";
      rows?: number;
    })
  | (DocumentFormFieldBase & {
      kind: "number";
      min?: number;
      step?: number;
    })
  | (DocumentFormFieldBase & {
      kind: "enum";
      options: DocumentFormFieldOption[];
    })
  | (DocumentFormFieldBase & {
      kind: "counterparty";
      optionsSource?: DocumentFormOwnerOptionsSource;
    })
  | (DocumentFormFieldBase & {
      kind: "currency";
    })
  | (DocumentFormFieldBase & {
      kind: "account";
      counterpartyField: string;
      optionsSource?: DocumentFormRequisiteOptionsSource;
    });

export type DocumentFormField = DocumentFormFieldInput;

export type DocumentFormBreakpoint = "base" | "sm" | "md" | "lg";

export type DocumentFormResponsiveCount = Partial<
  Record<DocumentFormBreakpoint, 1 | 2 | 3 | 4>
>;

export type DocumentFormRowField =
  | string
  | {
      name: string;
      span?: DocumentFormResponsiveCount;
    };

export interface DocumentFormRow {
  fields: DocumentFormRowField[];
  columns?: DocumentFormResponsiveCount;
}

export interface DocumentFormSectionLayout {
  rows: DocumentFormRow[];
}

export interface DocumentFormSection {
  id: string;
  title: string;
  description?: string;
  fields: DocumentFormField[];
  layout?: DocumentFormSectionLayout;
}

export type DocumentFormValues = Record<string, unknown>;

export interface DocumentFormDefinition {
  docType: IfrsDocumentType;
  label: string;
  family: IfrsDocumentFamily;
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  sections: DocumentFormSection[];
  defaultValues: () => DocumentFormValues;
  fromPayload: (payload: Record<string, unknown>) => DocumentFormValues;
  toPayload: (values: DocumentFormValues) => unknown;
}

export interface IfrsDocumentCatalogEntry {
  docType: IfrsDocumentType;
  label: string;
  family: IfrsDocumentFamily;
  docNoPrefix: string;
  schema: z.ZodTypeAny;
  creatable: boolean;
  hasTypedForm: boolean;
  adminOnly: boolean;
  listed: boolean;
  formDefinition: DocumentFormDefinition | null;
}

export type IfrsDocumentDefinition = IfrsDocumentCatalogEntry & {
  createModule: (deps: IfrsModuleDeps) => DocumentModule;
};
