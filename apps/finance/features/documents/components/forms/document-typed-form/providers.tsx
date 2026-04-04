"use client";

import { FormProvider, useForm } from "react-hook-form";
import { useCallback, useEffect, useId, useMemo } from "react";
import type { ReactNode } from "react";

import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";
import type { DocumentMutationDto } from "@/features/operations/documents/lib/mutations";
import type { UserRole } from "@/lib/auth/types";

import {
  DocumentTypedFormContextProvider,
  type DocumentTypedFormContextValue,
} from "./context";
import {
  findDependentAccountFieldNames,
  isAccountField,
  resolveDocumentFormDefaultValues,
  type DocumentFormMode,
} from "./helpers";
import { useAccountRequisiteOptions } from "./hooks/use-account-requisite-options";
import { useDerivedAccountCurrencyFields } from "./hooks/use-derived-account-currency-fields";
import { useDocumentFormSubmission } from "./hooks/use-document-form-submission";

type DocumentTypedFormProviderProps = {
  children: ReactNode;
  createDealId?: string;
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
  documentId?: string;
  initialPayload?: Record<string, unknown>;
  mode: DocumentFormMode;
};

export type CreateDocumentTypedFormProviderProps = {
  children: ReactNode;
  createDealId?: string;
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  disabled?: boolean;
  initialPayload?: Record<string, unknown>;
  onSuccess?: (result: DocumentMutationDto) => void;
};

export type EditDocumentTypedFormProviderProps = {
  children: ReactNode;
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  initialPayload: Record<string, unknown>;
  documentId: string;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
};

function DocumentTypedFormProvider({
  children,
  createDealId,
  docType,
  userRole,
  options,
  disabled = false,
  onSuccess,
  documentId,
  initialPayload,
  mode,
}: DocumentTypedFormProviderProps) {
  const formId = useId();
  const definition = useMemo(
    () => getDocumentFormDefinitionForRole({ docType, role: userRole }),
    [docType, userRole],
  );
  const defaultValues = useMemo(
    () =>
      resolveDocumentFormDefaultValues({
        definition,
        mode,
        initialPayload,
      }),
    [definition, initialPayload, mode],
  );
  const methods = useForm<DocumentFormValues>({
    defaultValues,
    mode: "onSubmit",
    shouldUnregister: false,
  });
  const { control, reset, setValue } = methods;

  const accountFields = useMemo(() => {
    if (!definition) {
      return [] as Array<Extract<DocumentFormField, { kind: "account" }>>;
    }

    return definition.sections
      .flatMap((section) => section.fields)
      .filter(isAccountField);
  }, [definition]);
  const derivedFields = useMemo(() => {
    if (!definition) {
      return [] as DocumentFormField[];
    }

    return definition.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.deriveFrom?.kind === "accountCurrency");
  }, [definition]);

  const currencyLabelById = useMemo(
    () =>
      new Map(
        options.currencies.map((currency) => [currency.id, currency.label] as const),
      ),
    [options.currencies],
  );
  const currencyCodeById = useMemo(
    () =>
      new Map(
        options.currencies.map((currency) => [currency.id, currency.code] as const),
      ),
    [options.currencies],
  );
  const selectOptions = useMemo(
    () => ({
      currencies: options.currencies.map((currency) => ({
        value: currency.code,
        label: currency.label,
      })),
      counterparties: options.counterparties.map((counterparty) => ({
        value: counterparty.id,
        label: counterparty.label,
      })),
      customers: options.customers.map((customer) => ({
        value: customer.id,
        label: customer.label,
      })),
      organizations: options.organizations.map((organization) => ({
        value: organization.id,
        label: organization.label,
      })),
    }),
    [
      options.counterparties,
      options.currencies,
      options.customers,
      options.organizations,
    ],
  );

  const {
    requisitesByOwnerKey,
    loadingOwnerKeys,
    accountCurrencyCodeById,
  } = useAccountRequisiteOptions({
    accountFields,
    control,
    currencyCodeById,
    currencyLabelById,
  });

  useDerivedAccountCurrencyFields({
    control,
    derivedFields,
    accountCurrencyCodeById,
    setValue,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const submission = useDocumentFormSubmission({
    createDealId,
    methods,
    definition,
    mode,
    docType,
    documentId,
    disabled,
    defaultValues,
    onSuccess,
  });

  const resetDependentAccountFields = useCallback(
    (ownerFieldName: string) => {
      for (const fieldName of findDependentAccountFieldNames(
        accountFields,
        ownerFieldName,
      )) {
        setValue(fieldName, "", { shouldDirty: true });
      }
    },
    [accountFields, setValue],
  );

  const value = useMemo<DocumentTypedFormContextValue>(
    () => ({
      state: {
        definition,
        disabled,
        submitting: submission.submitting,
        submitDisabled: submission.submitDisabled,
        resetDisabled: submission.resetDisabled,
        formError: submission.formError,
      },
      actions: {
        onSubmit: submission.onSubmit,
        handleReset: submission.handleReset,
        resetDependentAccountFields,
      },
      meta: {
        mode,
        docType,
        userRole,
        documentId,
        formId,
        options,
        selectOptions,
        requisitesByOwnerKey,
        loadingOwnerKeys,
        methods,
        onSuccess,
      },
    }),
    [
      definition,
      disabled,
      docType,
      documentId,
      formId,
      methods,
      mode,
      onSuccess,
      options,
      requisitesByOwnerKey,
      resetDependentAccountFields,
      loadingOwnerKeys,
      selectOptions,
      submission.formError,
      submission.handleReset,
      submission.onSubmit,
      submission.resetDisabled,
      submission.submitDisabled,
      submission.submitting,
      userRole,
    ],
  );

  return (
    <DocumentTypedFormContextProvider value={value}>
      <FormProvider {...methods}>{children}</FormProvider>
    </DocumentTypedFormContextProvider>
  );
}

export function CreateDocumentTypedFormProvider(
  props: CreateDocumentTypedFormProviderProps,
) {
  return <DocumentTypedFormProvider {...props} mode="create" />;
}

export function EditDocumentTypedFormProvider(
  props: EditDocumentTypedFormProviderProps,
) {
  return <DocumentTypedFormProvider {...props} mode="edit" />;
}
