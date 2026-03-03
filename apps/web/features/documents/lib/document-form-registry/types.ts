import { z } from "zod";

import type { TypedDocumentType } from "@/features/documents/lib/doc-types";

export type DocumentFormFieldOption = {
  value: string;
  label: string;
};

type DocumentFormFieldBase = {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
};

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
      kind: "counterparty" | "currency";
    })
  | (DocumentFormFieldBase & {
      kind: "account";
      counterpartyField: string;
    });

export type DocumentFormField = DocumentFormFieldInput;

export type DocumentFormSection = {
  id: string;
  title: string;
  description?: string;
  fields: DocumentFormField[];
};

export type DocumentFormValues = Record<string, unknown>;

export type DocumentFormDefinition = {
  docType: TypedDocumentType;
  label: string;
  family: "transfers" | "ifrs";
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  sections: DocumentFormSection[];
  defaultValues: () => DocumentFormValues;
  fromPayload: (payload: Record<string, unknown>) => DocumentFormValues;
  toPayload: (values: DocumentFormValues) => unknown;
};
