"use client";

import { createContext, use } from "react";
import type { BaseSyntheticEvent, ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { RequisiteOption } from "@/features/documents/lib/account-options";
import type {
  DocumentFormDefinition,
  DocumentFormValues,
} from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import type { DocumentMutationDto } from "@/features/operations/documents/lib/mutations";
import type { UserRole } from "@/lib/auth/types";

import type { DocumentFormMode } from "./helpers";

export type DocumentTypedFormSelectOption = {
  value: string;
  label: string;
};

export type DocumentTypedFormCounterpartySelectOption =
  DocumentTypedFormSelectOption & {
    customerIds: string[];
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
  handleCustomerSelection: (
    fieldName: string,
    customerId: string | null,
  ) => void;
  handleCounterpartySelection: (
    fieldName: string,
    counterpartyId: string | null,
  ) => void;
};

export type DocumentTypedFormMeta = {
  mode: DocumentFormMode;
  docType: string;
  userRole: UserRole;
  documentId?: string;
  formId: string;
  options: DocumentFormOptions;
  selectOptions: {
    currencies: DocumentTypedFormSelectOption[];
    counterparties: DocumentTypedFormCounterpartySelectOption[];
    customers: DocumentTypedFormSelectOption[];
    organizations: DocumentTypedFormSelectOption[];
  };
  customerFieldName: string | null;
  requisitesByOwnerKey: Map<string, RequisiteOption[]>;
  loadingOwnerKeys: Set<string>;
  accountCurrencyCodeById: Map<string, string>;
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
