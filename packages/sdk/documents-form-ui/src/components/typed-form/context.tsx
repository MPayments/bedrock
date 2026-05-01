"use client";

import { createContext, use } from "react";
import type { BaseSyntheticEvent, ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { RequisiteOption } from "../../lib/account-options";
import type {
  DocumentFormDefinition,
  DocumentFormValues,
} from "../../lib/document-form-registry";
import type { DocumentFormOptions } from "../../lib/form-options";
import type { DocumentMutationDto } from "../../lib/mutations";

import type { DocumentFormMode } from "./helpers";

export type DocumentTypedFormSelectOption = {
  value: string;
  label: string;
};

export type DocumentTypedFormState = {
  definition: DocumentFormDefinition | null;
  disabled: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  resetDisabled: boolean;
  formError: string | null;
};

export type DocumentTypedFormActions = {
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  handleReset: () => void;
  resetDependentAccountFields: (ownerFieldName: string) => void;
};

export type DocumentTypedFormMeta = {
  mode: DocumentFormMode;
  docType: string;
  isAdmin: boolean;
  documentId?: string;
  formId: string;
  options: DocumentFormOptions;
  selectOptions: {
    currencies: DocumentTypedFormSelectOption[];
    counterparties: DocumentTypedFormSelectOption[];
    customers: DocumentTypedFormSelectOption[];
    documents: Array<DocumentTypedFormSelectOption & { docType: string }>;
    organizations: DocumentTypedFormSelectOption[];
  };
  requisitesByOwnerKey: Map<string, RequisiteOption[]>;
  loadingOwnerKeys: Set<string>;
  methods: UseFormReturn<DocumentFormValues>;
  onSuccess?: (result: DocumentMutationDto) => void;
};

export type DocumentTypedFormContextValue = {
  state: DocumentTypedFormState;
  actions: DocumentTypedFormActions;
  meta: DocumentTypedFormMeta;
};

const DocumentTypedFormContext =
  createContext<DocumentTypedFormContextValue | null>(null);

export function DocumentTypedFormContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: DocumentTypedFormContextValue;
}) {
  return (
    <DocumentTypedFormContext value={value}>
      {children}
    </DocumentTypedFormContext>
  );
}

export function useDocumentTypedForm(): DocumentTypedFormContextValue {
  const context = use(DocumentTypedFormContext);

  if (!context) {
    throw new Error(
      "useDocumentTypedForm must be used inside a document typed form provider",
    );
  }

  return context;
}
