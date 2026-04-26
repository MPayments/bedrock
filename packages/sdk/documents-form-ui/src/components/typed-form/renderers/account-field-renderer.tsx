"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { DocumentFormValues } from "../../../lib/document-form-registry";
import { isUuid } from "../../../lib/validation";

import { useDocumentTypedForm } from "../context";
import {
  buildWatchedValueMap,
  findSelectedLabel,
  getDocumentFormFieldId,
  readValueAsString,
  resolveAccountFieldOwnerKey,
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
    meta: { loadingOwnerKeys, options, requisitesByOwnerKey },
  } = useDocumentTypedForm();
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const dependencyFieldNames = useMemo(
    () =>
      Array.from(
        new Set(
          field.currencyFieldName
            ? [field.counterpartyField, field.currencyFieldName]
            : [field.counterpartyField],
        ),
      ),
    [field.counterpartyField, field.currencyFieldName],
  );
  const watchedDependencyValues = useWatch({
    control,
    name: dependencyFieldNames as never[],
  });
  const dependencyValues = useMemo(
    () => buildWatchedValueMap(dependencyFieldNames, watchedDependencyValues),
    [dependencyFieldNames, watchedDependencyValues],
  );
  const ownerId = readValueAsString(dependencyValues[field.counterpartyField]).trim();
  const requisiteSource = resolveRequisiteFieldSource(field);
  const currencyIdByCode = useMemo(
    () =>
      new Map(
        options.currencies.map((currency) => [currency.code, currency.id] as const),
      ),
    [options.currencies],
  );
  const ownerKey =
    resolveAccountFieldOwnerKey({
      currencyIdByCode,
      field,
      values: dependencyValues,
    }) ?? "";
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
