"use client";

import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";

import type {
  DocumentFormField,
  DocumentFormValues,
} from "@/features/documents/lib/document-form-registry";

import { useDocumentTypedForm } from "../context";
import {
  fieldErrorMessage,
  getDocumentFormFieldId,
} from "../helpers";

export type DocumentTypedFormFieldRendererProps<
  TKind extends DocumentFormField["kind"] = DocumentFormField["kind"],
> = {
  field: DocumentFormField & { kind: TKind };
  className?: string;
};

export function useDocumentTypedFormDisabledState() {
  const {
    state: { disabled, submitting },
  } = useDocumentTypedForm();

  return {
    disabled,
    submitting,
  };
}

export function useDocumentTypedFormFieldError(fieldName: string) {
  const {
    formState: { errors },
  } = useFormContext<DocumentFormValues>();

  return fieldErrorMessage(errors, fieldName);
}

export function DocumentTypedFormFieldShell({
  children,
  className,
  description,
  errorMessage,
  field,
  inputId = getDocumentFormFieldId(field.name),
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  errorMessage: string | null;
  field: DocumentFormField;
  inputId?: string;
}) {
  return (
    <Field className={className} data-invalid={Boolean(errorMessage)}>
      <FieldLabel htmlFor={inputId}>{field.label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </Field>
  );
}
