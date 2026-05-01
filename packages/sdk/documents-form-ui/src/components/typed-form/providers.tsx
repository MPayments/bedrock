"use client";

import { FormProvider, useForm } from "react-hook-form";
import { useCallback, useEffect, useId, useMemo } from "react";
import type { ReactNode } from "react";

import { getDocumentFormDefinitionForRole } from "../../lib/document-form-registry";
import type {
  DocumentFormDefinitions,
  DocumentFormField,
  DocumentFormValues,
} from "../../lib/document-form-registry";
import type { DocumentFormOptions } from "../../lib/form-options";
import type { DocumentMutationDto } from "../../lib/mutations";

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
import { useResetIncompatibleAccountFields } from "./hooks/use-reset-incompatible-account-fields";
import {
  useDocumentFormSubmission,
  type DocumentFormCreateMutator,
  type DocumentFormUpdateMutator,
} from "./hooks/use-document-form-submission";

type DocumentTypedFormProviderProps = {
  children: ReactNode;
  createDealId?: string;
  docType: string;
  isAdmin: boolean;
  options: DocumentFormOptions;
  formDefinitions: DocumentFormDefinitions;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
  documentId?: string;
  initialPayload?: Record<string, unknown>;
  mode: DocumentFormMode;
  createMutator: DocumentFormCreateMutator;
  updateMutator: DocumentFormUpdateMutator;
};

export type CreateDocumentTypedFormProviderProps = {
  children: ReactNode;
  createDealId?: string;
  docType: string;
  isAdmin: boolean;
  options: DocumentFormOptions;
  formDefinitions: DocumentFormDefinitions;
  disabled?: boolean;
  initialPayload?: Record<string, unknown>;
  onSuccess?: (result: DocumentMutationDto) => void;
  createMutator: DocumentFormCreateMutator;
  updateMutator: DocumentFormUpdateMutator;
};

export type EditDocumentTypedFormProviderProps = {
  children: ReactNode;
  docType: string;
  isAdmin: boolean;
  options: DocumentFormOptions;
  formDefinitions: DocumentFormDefinitions;
  initialPayload: Record<string, unknown>;
  documentId: string;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
  createMutator: DocumentFormCreateMutator;
  updateMutator: DocumentFormUpdateMutator;
};

function DocumentTypedFormProvider({
  children,
  createDealId,
  createMutator,
  docType,
  formDefinitions,
  isAdmin,
  options,
  disabled = false,
  onSuccess,
  documentId,
  initialPayload,
  mode,
  updateMutator,
}: DocumentTypedFormProviderProps) {
  const formId = useId();
  const definition = useMemo(
    () =>
      getDocumentFormDefinitionForRole({
        definitions: formDefinitions,
        docType,
        isAdmin,
      }),
    [docType, formDefinitions, isAdmin],
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
  const currencyIdByCode = useMemo(
    () =>
      new Map(
        options.currencies.map((currency) => [currency.code, currency.id] as const),
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
      documents: (options.documents ?? []).map((document) => ({
        value: document.id,
        docType: document.docType,
        label: document.label,
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
      options.documents,
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
    currencyIdByCode,
    currencyCodeById,
    currencyLabelById,
  });

  useDerivedAccountCurrencyFields({
    control,
    derivedFields,
    accountCurrencyCodeById,
    setValue,
  });

  useResetIncompatibleAccountFields({
    accountFields,
    control,
    currencyIdByCode,
    loadingOwnerKeys,
    requisitesByOwnerKey,
    setValue,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const submission = useDocumentFormSubmission({
    createDealId,
    createMutator,
    methods,
    definition,
    mode,
    docType,
    documentId,
    disabled,
    defaultValues,
    onSuccess,
    updateMutator,
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
        isAdmin,
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
      isAdmin,
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
