"use client";

import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@bedrock/sdk-ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { DocumentFormValues } from "../../../lib/document-form-registry";
import {
  createEmptyFinancialLineFormValue,
  getFinancialLinePercentAmountPreview,
  getLockedFinancialLineCurrency,
  resolveFinancialLineCalcMethod,
} from "../../../lib/financial-lines";

import { useDocumentTypedForm } from "../context";
import {
  fieldErrorMessage,
  findSelectedLabel,
  readValueAsString,
} from "../helpers";
import {
  DocumentTypedFormFieldShell,
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
  useDocumentTypedFormFieldError,
} from "./shared";

const FINANCIAL_LINE_METHOD_LABELS = {
  fixed: "Сумма",
  percent: "Процент",
} as const;

export function FinancialLinesFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"financialLines">) {
  const {
    meta: {
      selectOptions: { currencies },
    },
  } = useDocumentTypedForm();
  const { control, formState, setValue } = useFormContext<DocumentFormValues>();
  const { errors } = formState;
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const errorMessage = useDocumentTypedFormFieldError(field.name);
  const { fields, append, remove } = useFieldArray({
    control,
    name: field.name as never,
  });
  const watchedFinancialLines = useWatch({
    control,
    name: field.name as never,
  }) as unknown;
  const financialLines = useMemo(
    () =>
      Array.isArray(watchedFinancialLines)
        ? (watchedFinancialLines as Array<Record<string, unknown>>)
        : [],
    [watchedFinancialLines],
  );
  const baseAmount = readValueAsString(
    useWatch({
      control,
      name: field.baseAmountFieldName as never,
    }),
  ).trim();
  const baseCurrency = readValueAsString(
    useWatch({
      control,
      name: field.baseCurrencyFieldName as never,
    }),
  )
    .trim()
    .toUpperCase();

  useEffect(() => {
    financialLines.forEach((line, index) => {
      const calcMethod = resolveFinancialLineCalcMethod({
        calcMethod: line.calcMethod,
        supportedCalcMethods: field.supportedCalcMethods,
      });
      if (calcMethod !== "percent") {
        return;
      }

      const lockedCurrency = getLockedFinancialLineCurrency({
        calcMethod,
        rowCurrency: line.currency,
        baseCurrency,
      });
      if (readValueAsString(line.currency) === lockedCurrency) {
        return;
      }

      setValue(`${field.name}.${index}.currency` as never, lockedCurrency as never, {
        shouldDirty: false,
      });
    });
  }, [baseCurrency, field.name, field.supportedCalcMethods, financialLines, setValue]);

  return (
    <DocumentTypedFormFieldShell
      className={className}
      description={field.description}
      errorMessage={errorMessage}
      field={field}
      hideDescription
      hideLabel
      inputId={field.name}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <FieldLabel>{field.label}</FieldLabel>
            {field.description ? (
              <FieldDescription>{field.description}</FieldDescription>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || submitting}
            onClick={() => append(createEmptyFinancialLineFormValue(field))}
          >
            <Plus className="size-4" />
            Добавить строку
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-sm border border-dashed p-3 text-sm text-muted-foreground">
            Строк пока нет.
          </div>
        ) : null}

        {fields.map((item, index) => {
          const currentLine = financialLines[index] ?? {};
          const calcMethod = resolveFinancialLineCalcMethod({
            calcMethod: currentLine.calcMethod,
            supportedCalcMethods: field.supportedCalcMethods,
          });
          const isPercent = calcMethod === "percent";
          const lockedCurrency = getLockedFinancialLineCurrency({
            calcMethod,
            rowCurrency: currentLine.currency,
            baseCurrency,
          });
          const percentAmountPreview = getFinancialLinePercentAmountPreview({
            baseAmount,
            baseCurrency,
            percent: currentLine.percent,
          });
          const calcMethodPath = `${field.name}.${index}.calcMethod`;
          const bucketPath = `${field.name}.${index}.bucket`;
          const currencyPath = `${field.name}.${index}.currency`;
          const amountPath = `${field.name}.${index}.amount`;
          const percentPath = `${field.name}.${index}.percent`;
          const memoPath = `${field.name}.${index}.memo`;

          return (
            <div
              key={item.id}
              className="grid gap-3 rounded-sm border p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
            >
              {field.supportedCalcMethods.length > 1 ? (
                <Field
                  data-invalid={Boolean(fieldErrorMessage(errors, calcMethodPath))}
                >
                  <FieldLabel>Метод</FieldLabel>
                  <Controller
                    control={control}
                    name={calcMethodPath as never}
                    render={({ field: controlledField }) => (
                      <Select
                        value={calcMethod}
                        disabled={disabled || submitting}
                        onValueChange={(value) => {
                          controlledField.onChange(value);
                          if (value === "percent") {
                            setValue(currencyPath as never, baseCurrency as never, {
                              shouldDirty: true,
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите метод">
                            {FINANCIAL_LINE_METHOD_LABELS[calcMethod]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {field.supportedCalcMethods.includes("fixed") ? (
                            <SelectItem value="fixed">Сумма</SelectItem>
                          ) : null}
                          {field.supportedCalcMethods.includes("percent") ? (
                            <SelectItem value="percent">Процент</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {fieldErrorMessage(errors, calcMethodPath) ? (
                    <p className="text-sm text-destructive">
                      {fieldErrorMessage(errors, calcMethodPath)}
                    </p>
                  ) : null}
                </Field>
              ) : null}

              <Field data-invalid={Boolean(fieldErrorMessage(errors, bucketPath))}>
                <FieldLabel>Назначение</FieldLabel>
                <Controller
                  control={control}
                  name={bucketPath as never}
                  render={({ field: controlledField }) => (
                    <Select
                      value={readValueAsString(controlledField.value)}
                      disabled={disabled || submitting}
                      onValueChange={(value) => controlledField.onChange(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите назначение">
                          {findSelectedLabel(controlledField.value, field.bucketOptions)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {field.bucketOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {fieldErrorMessage(errors, bucketPath) ? (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors, bucketPath)}
                  </p>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(fieldErrorMessage(errors, currencyPath))}>
                <FieldLabel>Валюта</FieldLabel>
                {isPercent ? (
                  <Input
                    type="text"
                    value={lockedCurrency}
                    placeholder="Валюта документа"
                    disabled
                    readOnly
                  />
                ) : (
                  <Controller
                    control={control}
                    name={currencyPath as never}
                    render={({ field: controlledField }) => (
                      <Select
                        value={readValueAsString(controlledField.value)}
                        disabled={disabled || submitting}
                        onValueChange={(value) => controlledField.onChange(value)}
                      >
                        <SelectTrigger>
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
                )}
                {fieldErrorMessage(errors, currencyPath) ? (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors, currencyPath)}
                  </p>
                ) : null}
              </Field>

              {isPercent ? (
                <Field data-invalid={Boolean(fieldErrorMessage(errors, percentPath))}>
                  <FieldLabel>Процент</FieldLabel>
                  <FieldDescription>
                    {percentAmountPreview === null
                      ? "Предпросмотр суммы появится после заполнения процента, суммы и валюты документа."
                      : `Предпросмотр суммы: ${percentAmountPreview}.`}
                  </FieldDescription>
                  <Controller
                    control={control}
                    name={percentPath as never}
                    render={({ field: controlledField }) => (
                      <InputGroup>
                        <InputGroupInput
                          type="text"
                          inputMode="decimal"
                          value={readValueAsString(controlledField.value)}
                          placeholder="1.25"
                          disabled={disabled || submitting}
                          onChange={(event) =>
                            controlledField.onChange(event.target.value)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    )}
                  />
                  {fieldErrorMessage(errors, percentPath) ? (
                    <p className="text-sm text-destructive">
                      {fieldErrorMessage(errors, percentPath)}
                    </p>
                  ) : null}
                </Field>
              ) : (
                <Field data-invalid={Boolean(fieldErrorMessage(errors, amountPath))}>
                  <FieldLabel>Сумма</FieldLabel>
                  <Controller
                    control={control}
                    name={amountPath as never}
                    render={({ field: controlledField }) => (
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={readValueAsString(controlledField.value)}
                        placeholder="0.00"
                        disabled={disabled || submitting}
                        onChange={(event) =>
                          controlledField.onChange(event.target.value)
                        }
                      />
                    )}
                  />
                  {fieldErrorMessage(errors, amountPath) ? (
                    <p className="text-sm text-destructive">
                      {fieldErrorMessage(errors, amountPath)}
                    </p>
                  ) : null}
                </Field>
              )}

              <Field data-invalid={Boolean(fieldErrorMessage(errors, memoPath))}>
                <FieldLabel>Комментарий</FieldLabel>
                <Controller
                  control={control}
                  name={memoPath as never}
                  render={({ field: controlledField }) => (
                    <Input
                      type="text"
                      value={readValueAsString(controlledField.value)}
                      placeholder="Опционально"
                      disabled={disabled || submitting}
                      onChange={(event) =>
                        controlledField.onChange(event.target.value)
                      }
                    />
                  )}
                />
                {fieldErrorMessage(errors, memoPath) ? (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors, memoPath)}
                  </p>
                ) : null}
              </Field>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || submitting}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Удалить строку</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </DocumentTypedFormFieldShell>
  );
}
