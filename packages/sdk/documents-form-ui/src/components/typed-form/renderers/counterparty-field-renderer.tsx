"use client";

import { Controller, useFormContext } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { DocumentFormValues } from "../../../lib/document-form-registry";

import { useDocumentTypedForm } from "../context";
import {
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

export function CounterpartyFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"counterparty">) {
  const {
    actions,
    meta: {
      selectOptions: { counterparties, organizations },
    },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const ownerSource = resolveOwnerFieldSource(field);
  const ownerOptions =
    ownerSource === "organizations" ? organizations : counterparties;
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
          <Select
            value={readValueAsString(controlledField.value)}
            disabled={disabled || submitting}
            onValueChange={(value) => {
              controlledField.onChange(value);
              actions.resetDependentAccountFields(field.name);
            }}
          >
            <SelectTrigger id={getDocumentFormFieldId(field.name)}>
              <SelectValue placeholder={`Выберите ${ownerNoun}`}>
                {findSelectedLabel(controlledField.value, ownerOptions)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ownerOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </DocumentTypedFormFieldShell>
  );
}
