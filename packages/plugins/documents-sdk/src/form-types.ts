import type { z } from "zod";

export type FinancialLineCalcMethod = "fixed" | "percent";
export type FxQuotePreviewRequestMode = "auto_cross";

export interface DocumentFormFieldOption {
  value: string;
  label: string;
}

export interface DocumentFormVisibilityRule {
  fieldName: string;
  equals: string[];
}

interface DocumentFormFieldBase {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  hidden?: boolean;
  visibleWhen?: DocumentFormVisibilityRule;
  deriveFrom?: {
    kind: "accountCurrency";
    accountFieldNames: string[];
  };
}

type DocumentFormOwnerOptionsSource = "counterparties" | "organizations";
type DocumentFormRequisiteOptionsSource =
  | "counterpartyRequisites"
  | "organizationRequisites";

export type DocumentFormField =
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
      kind: "customer";
    })
  | (DocumentFormFieldBase & {
      kind: "currency";
    })
  | (DocumentFormFieldBase & {
      kind: "document";
      disabled?: boolean;
      docTypes?: string[];
    })
  | (DocumentFormFieldBase & {
      kind: "account";
      counterpartyField: string;
      currencyFieldName?: string;
      optionsSource?: DocumentFormRequisiteOptionsSource;
    })
  | (DocumentFormFieldBase & {
      kind: "financialLines";
      bucketOptions: DocumentFormFieldOption[];
      supportedCalcMethods: FinancialLineCalcMethod[];
      baseAmountFieldName: string;
      baseCurrencyFieldName: string;
    })
  | (DocumentFormFieldBase & {
      kind: "fxQuotePreview";
      requestMode: FxQuotePreviewRequestMode;
      amountFieldName: string;
      fromCurrencyFieldName: string;
      toCurrencyFieldName: string;
    });

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

export interface DocumentFormDefinition<
  TDocType extends string = string,
  TFamily extends string = string,
> {
  docType: TDocType;
  label: string;
  family: TFamily;
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  sections: DocumentFormSection[];
  defaultValues: () => DocumentFormValues;
  fromPayload: (payload: Record<string, unknown>) => DocumentFormValues;
  toPayload: (values: DocumentFormValues) => unknown;
}

export interface DocumentCatalogEntry<
  TDocType extends string = string,
  TFamily extends string = string,
> {
  docType: TDocType;
  label: string;
  family: TFamily;
  docNoPrefix: string;
  schema: z.ZodTypeAny;
  creatable: boolean;
  hasTypedForm: boolean;
  adminOnly: boolean;
  listed: boolean;
  formDefinition: DocumentFormDefinition<TDocType, TFamily> | null;
}
