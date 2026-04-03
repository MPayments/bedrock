"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { Input } from "@bedrock/sdk-ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@bedrock/sdk-ui/components/input-group";

import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";

import { readValueAsString } from "../helpers";
import { useDocumentTypedFormSection } from "../section-context";
import {
  DocumentTypedFormFieldShell,
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
  useDocumentTypedFormFieldError,
} from "./shared";

export function AmountFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"amount">) {
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const { hiddenDerivedCurrencyFieldName } = useDocumentTypedFormSection();
  const watchedHiddenCurrencyValues = useWatch({
    control,
    name: hiddenDerivedCurrencyFieldName
      ? ([hiddenDerivedCurrencyFieldName] as never[])
      : ([] as never[]),
  });
  const hiddenCurrencyCode = readValueAsString(
    Array.isArray(watchedHiddenCurrencyValues)
      ? watchedHiddenCurrencyValues[0]
      : watchedHiddenCurrencyValues,
  )
    .trim()
    .toUpperCase();
  const showDerivedCurrencyAddon = Boolean(hiddenDerivedCurrencyFieldName);

  return (
    <DocumentTypedFormFieldShell
      className={className}
      description={
        field.description ?? "Введите сумму в основных единицах, например `1000.50`."
      }
      errorMessage={errorMessage}
      field={field}
    >
      <Controller
        control={control}
        name={field.name}
        render={({ field: controlledField }) =>
          showDerivedCurrencyAddon ? (
            <InputGroup>
              <InputGroupInput
                id={`document-field-${field.name}`}
                type="text"
                inputMode="decimal"
                value={readValueAsString(controlledField.value)}
                placeholder={field.placeholder ?? "0.00"}
                disabled={disabled || submitting}
                aria-invalid={Boolean(errorMessage)}
                onChange={(event) => controlledField.onChange(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{hiddenCurrencyCode || "..."}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <Input
              id={`document-field-${field.name}`}
              type="text"
              inputMode="decimal"
              value={readValueAsString(controlledField.value)}
              placeholder={field.placeholder ?? "0.00"}
              disabled={disabled || submitting}
              onChange={(event) => controlledField.onChange(event.target.value)}
            />
          )
        }
      />
    </DocumentTypedFormFieldShell>
  );
}
