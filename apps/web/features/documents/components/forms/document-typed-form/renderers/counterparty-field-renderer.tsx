"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";

import { useDocumentTypedForm } from "../context";
import {
  filterCounterpartyOptionsByCustomerId,
  findSelectedLabel,
  getDocumentFormFieldId,
  readValueAsString,
  resolveOwnerFieldSource,
} from "../helpers";
import {
  DocumentTypedFormFieldShell,
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
  useDocumentTypedFormFieldError,
} from "./shared";
import { SearchableSelectField } from "./searchable-select-field";

export function CounterpartyFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"counterparty">) {
  const {
    actions,
    meta: {
      customerFieldName,
      selectOptions: { counterparties, organizations },
    },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const ownerSource = resolveOwnerFieldSource(field);
  const selectedCustomerId = useWatch({
    control,
    name: customerFieldName ?? "__customer__",
  });
  const ownerOptions =
    ownerSource === "organizations"
      ? organizations
      : filterCounterpartyOptionsByCustomerId(
          counterparties,
          readValueAsString(selectedCustomerId).trim(),
        );
  const ownerNoun =
    ownerSource === "organizations" ? "организацию" : "контрагента";

  return (
    <DocumentTypedFormFieldShell
      className={className}
      description={field.description}
      errorMessage={errorMessage}
      field={field}
    >
      <Controller
        control={control}
        name={field.name}
        render={({ field: controlledField }) => (
          <SearchableSelectField
            inputId={getDocumentFormFieldId(field.name)}
            value={readValueAsString(controlledField.value)}
            disabled={disabled || submitting}
            invalid={Boolean(errorMessage)}
            options={ownerOptions}
            clearable
            placeholder={`Выберите ${ownerNoun}`}
            searchPlaceholder={`Поиск ${ownerNoun}...`}
            emptyLabel={
              ownerSource === "organizations"
                ? "Организация не найдена"
                : "Контрагент не найден"
            }
            onValueChange={(value) => {
              if (ownerSource === "organizations") {
                controlledField.onChange(value);
                actions.resetDependentAccountFields(field.name);
                return;
              }

              actions.handleCounterpartySelection(field.name, value);
            }}
          />
        )}
      />
    </DocumentTypedFormFieldShell>
  );
}
