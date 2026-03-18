"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
import { isUuid } from "@/lib/resources/http";

import { useDocumentTypedForm } from "../context";
import {
  findSelectedLabel,
  getDocumentFormFieldId,
  readValueAsString,
  resolveOwnerKey,
  resolveRequisiteFieldSource,
} from "../helpers";
import {
  DocumentTypedFormFieldShell,
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
  useDocumentTypedFormFieldError,
} from "./shared";

export function AccountFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"account">) {
  const {
    meta: { loadingOwnerKeys, requisitesByOwnerKey },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const ownerId = readValueAsString(
    useWatch({
      control,
      name: field.counterpartyField,
    }),
  ).trim();
  const requisiteSource = resolveRequisiteFieldSource(field);
  const ownerKey = resolveOwnerKey({
    ownerId,
    requisiteSource,
  });
  const accountOptions = isUuid(ownerId)
    ? (requisitesByOwnerKey.get(ownerKey) ?? [])
    : [];
  const accountSelectOptions = accountOptions.map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const isLoading = loadingOwnerKeys.has(ownerKey);
  const hasOwner = isUuid(ownerId);
  const ownerNoun =
    requisiteSource === "organizationRequisites"
      ? "организацию"
      : "контрагента";

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
            disabled={
              disabled ||
              submitting ||
              !hasOwner ||
              isLoading ||
              accountOptions.length === 0
            }
            onValueChange={(value) => controlledField.onChange(value)}
          >
            <SelectTrigger id={getDocumentFormFieldId(field.name)}>
              <SelectValue
                placeholder={
                  !hasOwner
                    ? `Сначала выберите ${ownerNoun}`
                    : isLoading
                      ? "Загрузка реквизитов..."
                      : "Выберите реквизит"
                }
              >
                {findSelectedLabel(controlledField.value, accountSelectOptions)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
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
