"use client";

import { Controller, useFormContext } from "react-hook-form";

import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import type {
  DocumentFormField,
  DocumentFormValues,
} from "@/features/documents/lib/document-form-registry";

import { useDocumentTypedForm } from "../context";
import {
  findSelectedLabel,
  getDocumentFormFieldId,
  readValueAsString,
} from "../helpers";
import {
  DocumentTypedFormFieldShell,
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
  useDocumentTypedFormFieldError,
} from "./shared";

function resolveInputType(
  field: DocumentFormField & {
    kind: "datetime" | "date" | "month" | "text";
  },
) {
  if (field.kind === "datetime") {
    return "datetime-local";
  }

  if (field.kind === "date") {
    return "date";
  }

  if (field.kind === "month") {
    return "month";
  }

  return "text";
}

export function TextLikeFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"datetime" | "date" | "month" | "text">) {
  const { register } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

  return (
    <DocumentTypedFormFieldShell
      className={className}
      description={field.description}
      errorMessage={errorMessage}
      field={field}
    >
      <Input
        id={getDocumentFormFieldId(field.name)}
        type={resolveInputType(field)}
        placeholder={field.placeholder}
        disabled={disabled || submitting}
        {...register(field.name)}
      />
    </DocumentTypedFormFieldShell>
  );
}

export function TextareaFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"textarea">) {
  const { register } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

  return (
    <DocumentTypedFormFieldShell
      className={className}
      description={field.description}
      errorMessage={errorMessage}
      field={field}
    >
      <Textarea
        id={getDocumentFormFieldId(field.name)}
        rows={field.rows ?? 3}
        placeholder={field.placeholder}
        disabled={disabled || submitting}
        {...register(field.name)}
      />
    </DocumentTypedFormFieldShell>
  );
}

export function NumberFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"number">) {
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

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
          <Input
            id={getDocumentFormFieldId(field.name)}
            type="number"
            min={field.min}
            step={field.step ?? 1}
            value={readValueAsString(controlledField.value)}
            placeholder={field.placeholder}
            disabled={disabled || submitting}
            onChange={(event) => controlledField.onChange(event.target.value)}
          />
        )}
      />
    </DocumentTypedFormFieldShell>
  );
}

export function EnumFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"enum">) {
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

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
            onValueChange={(value) => controlledField.onChange(value)}
          >
            <SelectTrigger id={getDocumentFormFieldId(field.name)}>
              <SelectValue placeholder="Выберите значение">
                {findSelectedLabel(controlledField.value, field.options)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
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

export function CurrencyFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"currency">) {
  const {
    meta: {
      selectOptions: { currencies },
    },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

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
            onValueChange={(value) => controlledField.onChange(value)}
          >
            <SelectTrigger id={getDocumentFormFieldId(field.name)}>
              <SelectValue placeholder="Выберите валюту">
                {findSelectedLabel(controlledField.value, currencies)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {currencies.map((option) => (
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

export function CustomerFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"customer">) {
  const {
    meta: {
      selectOptions: { customers },
    },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);

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
            onValueChange={(value) => controlledField.onChange(value)}
          >
            <SelectTrigger id={getDocumentFormFieldId(field.name)}>
              <SelectValue placeholder="Выберите клиента">
                {findSelectedLabel(controlledField.value, customers)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((option) => (
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
