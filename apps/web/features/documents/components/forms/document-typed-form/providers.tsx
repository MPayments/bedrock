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
  filterCounterpartyOptionsByCustomerId,
  findDependentAccountFieldNames,
  findCounterpartyFieldNames,
  findCustomerFieldName,
  findCustomerIdForCounterparty,
  findSingleCounterpartyIdForCustomer,
  isCounterpartyLinkedToCustomer,
  isAccountField,
  readValueAsString,
  resolveDocumentFormDefaultValues,
  type DocumentFormMode,
} from "./helpers";
import { useAccountRequisiteOptions } from "./hooks/use-account-requisite-options";
import { useDerivedAccountCurrencyFields } from "./hooks/use-derived-account-currency-fields";
import { useDocumentFormSubmission } from "./hooks/use-document-form-submission";

type DocumentTypedFormProviderProps = {
  children: ReactNode;
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
  documentId?: string;
  initialPayload?: Record<string, unknown>;
  initialValues?: DocumentFormValues;
  mode: DocumentFormMode;
};

export type CreateDocumentTypedFormProviderProps = {
  children: ReactNode;
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  disabled?: boolean;
  onSuccess?: (result: DocumentMutationDto) => void;
  initialValues?: DocumentFormValues;
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
  docType,
  userRole,
  options,
  disabled = false,
  onSuccess,
  documentId,
  initialPayload,
  initialValues,
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
        initialValues,
      }),
    [definition, initialPayload, initialValues, mode],
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
  const formFields = useMemo(
    () => definition?.sections.flatMap((section) => section.fields) ?? [],
    [definition],
  );
  const customerFieldName = useMemo(
    () => findCustomerFieldName(formFields),
    [formFields],
  );
  const counterpartyFieldNames = useMemo(
    () => findCounterpartyFieldNames(formFields),
    [formFields],
  );

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
        customerIds: counterparty.customerIds,
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
  const handleCustomerSelection = useCallback(
    (fieldName: string, customerId: string | null) => {
      const normalizedCustomerId = readValueAsString(customerId).trim();
      setValue(fieldName, normalizedCustomerId, { shouldDirty: true });
      const nextCounterpartyId = normalizedCustomerId
        ? findSingleCounterpartyIdForCustomer(
            selectOptions.counterparties,
            normalizedCustomerId,
          ) ?? ""
        : "";

      for (const counterpartyFieldName of counterpartyFieldNames) {
        const selectedCounterpartyId = readValueAsString(
          methods.getValues(counterpartyFieldName),
        ).trim();

        if (
          selectedCounterpartyId &&
          isCounterpartyLinkedToCustomer({
            options: selectOptions.counterparties,
            counterpartyId: selectedCounterpartyId,
            customerId: normalizedCustomerId,
          })
        ) {
          continue;
        }

        if (selectedCounterpartyId === nextCounterpartyId) {
          continue;
        }

        setValue(counterpartyFieldName, nextCounterpartyId, { shouldDirty: true });
        resetDependentAccountFields(counterpartyFieldName);
      }
    },
    [
      counterpartyFieldNames,
      methods,
      resetDependentAccountFields,
      selectOptions.counterparties,
      setValue,
    ],
  );
  const handleCounterpartySelection = useCallback(
    (fieldName: string, counterpartyId: string | null) => {
      const normalizedCounterpartyId = readValueAsString(counterpartyId).trim();
      setValue(fieldName, normalizedCounterpartyId, { shouldDirty: true });
      resetDependentAccountFields(fieldName);

      if (!customerFieldName) {
        return;
      }

      const linkedCustomerId = findCustomerIdForCounterparty(
        selectOptions.counterparties,
        normalizedCounterpartyId,
      );
      const currentCustomerId = readValueAsString(
        methods.getValues(customerFieldName),
      ).trim();

      if (
        currentCustomerId &&
        isCounterpartyLinkedToCustomer({
          options: selectOptions.counterparties,
          counterpartyId: normalizedCounterpartyId,
          customerId: currentCustomerId,
        })
      ) {
        return;
      }

      const nextCustomerId = linkedCustomerId ?? "";
      setValue(customerFieldName, nextCustomerId, { shouldDirty: true });
    },
    [
      customerFieldName,
      methods,
      resetDependentAccountFields,
      selectOptions.counterparties,
      setValue,
    ],
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
        handleCustomerSelection,
        handleCounterpartySelection,
      },
      meta: {
        mode,
        docType,
        userRole,
        documentId,
        formId,
        options,
        selectOptions,
        customerFieldName,
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
      customerFieldName,
      handleCounterpartySelection,
      handleCustomerSelection,
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
