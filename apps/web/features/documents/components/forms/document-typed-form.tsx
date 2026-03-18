"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ZodError } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
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
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import type { UserRole } from "@/lib/auth/types";
import { isUuid } from "@/lib/resources/http";
import {
  fetchRequisiteOptions,
  type RequisiteOption,
} from "@/features/documents/lib/account-options";
import {
  getDocumentFormDefinitionForRole,
  type DocumentFormBreakpoint,
  type DocumentFormField,
  type DocumentFormResponsiveCount,
} from "@/features/documents/lib/document-form-registry";
import {
  createEmptyFinancialLineFormValue,
  getFinancialLinePercentAmountPreview,
  getLockedFinancialLineCurrency,
  resolveFinancialLineCalcMethod,
} from "@/features/documents/lib/financial-lines";
import {
  buildFxQuotePreviewRequest,
  fetchFxQuotePreview,
  formatFxQuotePreviewMinorAmount,
  formatFxQuotePreviewTimestamp,
  getFinancialLineBucketLabel,
} from "@/features/documents/lib/fx-quote-preview";
import { formatRate } from "@/features/fx/rates/lib/format";
import { resolveDocumentFormSectionRows } from "@/features/documents/lib/document-form-registry/layout";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import {
  createDocumentDraft,
  updateDocumentDraft,
  type DocumentMutationDto,
} from "@/features/operations/documents/lib/mutations";

type DocumentFormValues = Record<string, unknown>;

type DocumentTypedFormProps = {
  mode: "create" | "edit";
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  initialPayload?: Record<string, unknown>;
  documentId?: string;
  disabled?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  onSuccess?: (result: DocumentMutationDto) => void;
  formId?: string;
  actionsPlacement?: "footer" | "external";
  onActionStateChange?: (state: DocumentTypedFormActionState) => void;
};

export type DocumentTypedFormActionState = {
  submitting: boolean;
  submitDisabled: boolean;
  resetDisabled: boolean;
};

function fieldErrorMessage(errors: unknown, fieldPath: string): string | null {
  const segments = fieldPath.split(".");
  let current = errors as Record<string, unknown> | undefined;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = current[segment] as Record<string, unknown> | undefined;
  }

  const raw =
    current && typeof current === "object"
      ? (current as { message?: unknown }).message
      : undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }

  return null;
}

function isAccountField(field: DocumentFormField): field is Extract<DocumentFormField, { kind: "account" }> {
  return field.kind === "account";
}

function isFieldVisible(
  field: DocumentFormField,
  values: DocumentFormValues | undefined,
): boolean {
  if (!field.visibleWhen) {
    return true;
  }

  const actual = readValueAsString(values?.[field.visibleWhen.fieldName]).trim();
  return field.visibleWhen.equals.includes(actual);
}

function resolveOwnerFieldSource(
  field: Extract<DocumentFormField, { kind: "counterparty" }>,
) {
  return field.optionsSource ?? "counterparties";
}

function resolveRequisiteFieldSource(
  field: Extract<DocumentFormField, { kind: "account" }>,
) {
  return field.optionsSource ?? "counterpartyRequisites";
}

function resolveOwnerKey(input: {
  ownerId: string;
  requisiteSource: "counterpartyRequisites" | "organizationRequisites";
}) {
  return `${input.requisiteSource}:${input.ownerId}`;
}

function readValueAsString(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "bigint") {
    return String(input);
  }

  return "";
}

function findSelectedLabel(
  value: unknown,
  options: Array<{ value: string; label: string }>,
): string | undefined {
  const normalizedValue = readValueAsString(value).trim();
  if (!normalizedValue) {
    return undefined;
  }

  return options.find((option) => option.value === normalizedValue)?.label;
}

const RESPONSIVE_BREAKPOINTS: DocumentFormBreakpoint[] = [
  "base",
  "sm",
  "md",
  "lg",
];

const GRID_COLUMN_CLASS_NAMES: Record<
  DocumentFormBreakpoint,
  Record<1 | 2 | 3 | 4, string>
> = {
  base: {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  },
  sm: {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  },
  md: {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  },
  lg: {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  },
};

const GRID_SPAN_CLASS_NAMES: Record<
  DocumentFormBreakpoint,
  Record<1 | 2 | 3 | 4, string>
> = {
  base: {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
  },
  sm: {
    1: "sm:col-span-1",
    2: "sm:col-span-2",
    3: "sm:col-span-3",
    4: "sm:col-span-4",
  },
  md: {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
  },
  lg: {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
  },
};

function getResponsiveGridClassName(columns?: DocumentFormResponsiveCount): string {
  const resolvedColumns: DocumentFormResponsiveCount = {
    base: 1,
    ...columns,
  };

  return cn(
    "grid gap-4",
    ...RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
      const columnCount = resolvedColumns[breakpoint];
      return columnCount ? [GRID_COLUMN_CLASS_NAMES[breakpoint][columnCount]] : [];
    }),
  );
}

function getResponsiveGridItemClassName(
  span?: DocumentFormResponsiveCount,
): string | undefined {
  if (!span) {
    return undefined;
  }

  return cn(
    ...RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
      const columnSpan = span[breakpoint];
      return columnSpan ? [GRID_SPAN_CLASS_NAMES[breakpoint][columnSpan]] : [];
    }),
  );
}

function FinancialLinesField({
  control,
  setValue,
  field,
  currencySelectOptions,
  disabled,
  submitting,
  errors,
  className,
}: {
  control: ReturnType<typeof useForm<DocumentFormValues>>["control"];
  setValue: ReturnType<typeof useForm<DocumentFormValues>>["setValue"];
  field: Extract<DocumentFormField, { kind: "financialLines" }>;
  currencySelectOptions: Array<{ value: string; label: string }>;
  disabled: boolean;
  submitting: boolean;
  errors: unknown;
  className?: string;
}) {
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
    <Field key={field.name} className={className}>
      <div className="flex items-center justify-between gap-3">
        <div>
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

      <div className="space-y-3">
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
                            setValue(currencyPath, baseCurrency, {
                              shouldDirty: true,
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите метод" />
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
                <FieldLabel>Bucket</FieldLabel>
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
                        <SelectValue placeholder="Выберите bucket">
                          {findSelectedLabel(
                            controlledField.value,
                            field.bucketOptions,
                          )}
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
                            {findSelectedLabel(
                              controlledField.value,
                              currencySelectOptions,
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {currencySelectOptions.map((option) => (
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
                <Field
                  data-invalid={Boolean(fieldErrorMessage(errors, percentPath))}
                >
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
                <Field
                  data-invalid={Boolean(fieldErrorMessage(errors, amountPath))}
                >
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
    </Field>
  );
}

type FxQuotePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      preview: Awaited<ReturnType<typeof fetchFxQuotePreview>>;
    };

function FxQuotePreviewField({
  control,
  field,
  disabled,
  submitting,
  className,
}: {
  control: ReturnType<typeof useForm<DocumentFormValues>>["control"];
  field: Extract<DocumentFormField, { kind: "fxQuotePreview" }>;
  disabled: boolean;
  submitting: boolean;
  className?: string;
}) {
  const amount = readValueAsString(
    useWatch({
      control,
      name: field.amountFieldName as never,
    }),
  ).trim();
  const fromCurrency = readValueAsString(
    useWatch({
      control,
      name: field.fromCurrencyFieldName as never,
    }),
  )
    .trim()
    .toUpperCase();
  const toCurrency = readValueAsString(
    useWatch({
      control,
      name: field.toCurrencyFieldName as never,
    }),
  )
    .trim()
    .toUpperCase();
  const request = useMemo(
    () =>
      buildFxQuotePreviewRequest({
        amount,
        fromCurrency,
        toCurrency,
      }),
    [amount, fromCurrency, toCurrency],
  );
  const requestKey = request
    ? `${request.fromCurrency}:${request.toCurrency}:${request.fromAmountMinor}`
    : null;
  const [state, setState] = useState<FxQuotePreviewState>({
    status: "idle",
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!request || disabled || submitting) {
      setState({ status: "idle" });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setState({ status: "loading" });

      fetchFxQuotePreview({
        request,
        signal: controller.signal,
      })
        .then((preview) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setState({
            status: "ready",
            preview,
          });
        })
        .catch((error) => {
          if (controller.signal.aborted || requestIdRef.current !== requestId) {
            return;
          }

          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить текущую котировку",
          });
        });
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [disabled, request, requestKey, submitting]);

  return (
    <Field key={field.name} className={className}>
      <Card size="sm" className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>{field.label}</CardTitle>
          <CardDescription>
            Индикативная котировка обновляется автоматически по текущим рыночным данным.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          {state.status === "idle" ? (
            <p className="text-sm text-muted-foreground">
              Заполните сумму и валютную пару, чтобы увидеть текущую котировку.
            </p>
          ) : null}

          {state.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              <span>Обновляем котировку…</span>
            </div>
          ) : null}

          {state.status === "error" ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          {state.status === "ready" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Списание</p>
                  <p className="font-medium">
                    {state.preview.fromAmount} {state.preview.fromCurrency}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Получение</p>
                  <p className="font-medium">
                    {state.preview.toAmount} {state.preview.toCurrency}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Курс</p>
                  <p className="font-medium">
                    {formatRate(state.preview.rateNum, state.preview.rateDen)}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Действует до</p>
                  <p className="font-medium">
                    {formatFxQuotePreviewTimestamp(state.preview.expiresAt)}
                  </p>
                </div>
              </div>

              {typeof state.preview.pricingTrace.summary === "string" &&
              state.preview.pricingTrace.summary.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {state.preview.pricingTrace.summary}
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Маршрут
                </p>
                <div className="space-y-2">
                  {state.preview.legs.map((leg) => (
                    <div
                      key={`${leg.idx}:${leg.fromCurrency}:${leg.toCurrency}`}
                      className="rounded-sm border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {leg.fromCurrency} → {leg.toCurrency}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRate(leg.rateNum, leg.rateDen)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatFxQuotePreviewMinorAmount({
                          amountMinor: leg.fromAmountMinor,
                          currency: leg.fromCurrency,
                        })}{" "}
                        →{" "}
                        {formatFxQuotePreviewMinorAmount({
                          amountMinor: leg.toAmountMinor,
                          currency: leg.toCurrency,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {state.preview.feeComponents.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fee components
                  </p>
                  <div className="space-y-2">
                    {state.preview.feeComponents.map((component) => (
                      <div key={component.id} className="rounded-sm border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {component.memo ?? component.kind}
                          </p>
                          <p className="text-sm">
                            {formatFxQuotePreviewMinorAmount({
                              amountMinor: component.amountMinor,
                              currency: component.currency,
                            })}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {component.source}
                          {component.accountingTreatment
                            ? ` · ${component.accountingTreatment}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {state.preview.financialLines.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Generated financial lines
                  </p>
                  <div className="space-y-2">
                    {state.preview.financialLines.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-sm border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {getFinancialLineBucketLabel(line.bucket)}
                          </p>
                          <p className="text-sm">
                            {formatFxQuotePreviewMinorAmount({
                              amountMinor: line.amountMinor,
                              currency: line.currency,
                            })}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {line.source}
                          {line.memo ? ` · ${line.memo}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </Field>
  );
}

export function DocumentTypedForm({
  mode,
  docType,
  userRole,
  options,
  initialPayload,
  documentId,
  disabled = false,
  submitLabel = mode === "create" ? "Создать документ" : "Сохранить черновик",
  submittingLabel = mode === "create" ? "Создание..." : "Сохранение...",
  onSuccess,
  formId,
  actionsPlacement = "footer",
  onActionStateChange,
}: DocumentTypedFormProps) {
  const generatedFormId = useId();
  const resolvedFormId = formId ?? generatedFormId;
  const definition = useMemo(
    () => getDocumentFormDefinitionForRole({ docType, role: userRole }),
    [docType, userRole],
  );

  const defaultValues = useMemo(() => {
    if (!definition) {
      return {};
    }

    if (mode === "edit" && initialPayload) {
      return definition.fromPayload(initialPayload);
    }

    return definition.defaultValues();
  }, [definition, initialPayload, mode]);

  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<DocumentFormValues>({
    defaultValues,
    mode: "onSubmit",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [requisitesByOwnerKey, setRequisitesByOwnerKey] = useState(
    new Map<string, RequisiteOption[]>(),
  );
  const [loadingOwnerKeys, setLoadingOwnerKeys] = useState(
    new Set<string>(),
  );
  const loadingOwnerKeysRef = useRef(new Set<string>());

  const accountFields = useMemo(() => {
    if (!definition) {
      return [] as Extract<DocumentFormField, { kind: "account" }>[];
    }

    return definition.sections
      .flatMap((section) => section.fields)
      .filter(isAccountField);
  }, [definition]);

  const currencyLabelById = useMemo(
    () => new Map(options.currencies.map((currency) => [currency.id, currency.label])),
    [options.currencies],
  );
  const currencyCodeById = useMemo(
    () => new Map(options.currencies.map((currency) => [currency.id, currency.code])),
    [options.currencies],
  );
  const currencySelectOptions = useMemo(
    () =>
      options.currencies.map((currency) => ({
        value: currency.code,
        label: currency.label,
      })),
    [options.currencies],
  );
  const counterpartySelectOptions = useMemo(
    () =>
      options.counterparties.map((counterparty) => ({
        value: counterparty.id,
        label: counterparty.label,
      })),
    [options.counterparties],
  );
  const customerSelectOptions = useMemo(
    () =>
      options.customers.map((customer) => ({
        value: customer.id,
        label: customer.label,
      })),
    [options.customers],
  );
  const organizationSelectOptions = useMemo(
    () =>
      options.organizations.map((organization) => ({
        value: organization.id,
        label: organization.label,
      })),
    [options.organizations],
  );
  const accountCurrencyCodeById = useMemo(() => {
    const next = new Map<string, string>();

    for (const accountOptions of requisitesByOwnerKey.values()) {
      for (const option of accountOptions) {
        const currencyCode = currencyCodeById.get(option.currencyId);
        if (currencyCode) {
          next.set(option.id, currencyCode);
        }
      }
    }

    return next;
  }, [currencyCodeById, requisitesByOwnerKey]);
  const derivedFields = useMemo(() => {
    if (!definition) {
      return [] as DocumentFormField[];
    }

    return definition.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.deriveFrom?.kind === "accountCurrency");
  }, [definition]);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (!definition || accountFields.length === 0) {
      return;
    }

    for (const field of accountFields) {
      const ownerId = readValueAsString(
        watchedValues?.[field.counterpartyField],
      ).trim();
      const requisiteSource = resolveRequisiteFieldSource(field);
      const ownerKey = resolveOwnerKey({
        ownerId,
        requisiteSource,
      });

      if (!isUuid(ownerId)) {
        continue;
      }

      if (
        requisitesByOwnerKey.has(ownerKey) ||
        loadingOwnerKeysRef.current.has(ownerKey)
      ) {
        continue;
      }

      loadingOwnerKeysRef.current.add(ownerKey);
      setLoadingOwnerKeys(
        (current) => new Set([...current, ownerKey]),
      );

      fetchRequisiteOptions({
        ownerId,
        ownerType:
          requisiteSource === "organizationRequisites"
            ? "organization"
            : "counterparty",
        currencyLabelById,
      })
        .then((accountOptions) => {
          setRequisitesByOwnerKey((current) => {
            const next = new Map(current);
            next.set(ownerKey, accountOptions);
            return next;
          });
        })
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить реквизиты",
          );
        })
        .finally(() => {
          loadingOwnerKeysRef.current.delete(ownerKey);
          setLoadingOwnerKeys((current) => {
            const next = new Set(current);
            next.delete(ownerKey);
            return next;
          });
        });
    }
  }, [accountFields, currencyLabelById, definition, requisitesByOwnerKey, watchedValues]);

  useEffect(() => {
    for (const field of derivedFields) {
      if (field.deriveFrom?.kind !== "accountCurrency") {
        continue;
      }

      const selectedAccountIds = field.deriveFrom.accountFieldNames
        .map((accountFieldName) =>
          readValueAsString(watchedValues?.[accountFieldName]).trim(),
        )
        .filter((accountId) => accountId.length > 0);

      if (selectedAccountIds.length === 0) {
        if (readValueAsString(watchedValues?.[field.name]).trim().length > 0) {
          setValue(field.name, "", { shouldDirty: false });
        }
        continue;
      }

      const resolvedCurrencyCodes = selectedAccountIds
        .map((accountId) => accountCurrencyCodeById.get(accountId))
        .filter((currencyCode): currencyCode is string => Boolean(currencyCode));

      if (resolvedCurrencyCodes.length !== selectedAccountIds.length) {
        continue;
      }

      const derivedCurrencyCode = resolvedCurrencyCodes[0] ?? "";
      if (
        derivedCurrencyCode.length > 0 &&
        readValueAsString(watchedValues?.[field.name]).trim() !== derivedCurrencyCode
      ) {
        setValue(field.name, derivedCurrencyCode, { shouldDirty: false });
      }
    }
  }, [accountCurrencyCodeById, derivedFields, setValue, watchedValues]);

  const submitDisabled =
    !definition ||
    disabled ||
    submitting ||
    (mode === "edit" && (!documentId || !isDirty));
  const resetDisabled = !definition || disabled || submitting || !isDirty;

  useEffect(() => {
    onActionStateChange?.({
      submitting,
      submitDisabled,
      resetDisabled,
    });
  }, [onActionStateChange, resetDisabled, submitDisabled, submitting]);

  if (!definition) {
    return (
      <div className="text-sm text-muted-foreground">
        Для типа <span className="font-mono">{docType}</span> типизированная форма недоступна.
      </div>
    );
  }

  function resetDependentAccountFields(counterpartyFieldName: string) {
    for (const field of accountFields) {
      if (field.counterpartyField === counterpartyFieldName) {
        setValue(field.name, "", { shouldDirty: true });
      }
    }
  }

  function mapZodValidationError(error: ZodError) {
    const fallbackMessage =
      error.issues[0]?.message ?? "Валидация формы завершилась с ошибкой";
    setFormError(fallbackMessage);

    for (const issue of error.issues) {
      const fieldName = issue.path.map(String).join(".");
      if (fieldName.length === 0) {
        continue;
      }

      setError(fieldName, {
        type: "manual",
        message: issue.message,
      });
    }
  }

  async function handleFormSubmit(values: DocumentFormValues) {
    if (disabled) {
      return;
    }

    if (!definition) {
      return;
    }

    setFormError(null);
    clearErrors();

    let payload: unknown;
    try {
      payload = definition.toPayload(values);
    } catch (error) {
      if (error instanceof ZodError) {
        mapZodValidationError(error);
        return;
      }

      setFormError(
        error instanceof Error ? error.message : "Не удалось собрать payload документа",
      );
      return;
    }

    setSubmitting(true);
    const mutationResult =
      mode === "create"
        ? await createDocumentDraft({ docType, payload })
        : await updateDocumentDraft({
            docType,
            documentId: documentId ?? "",
            payload,
          });
    setSubmitting(false);

    if (!mutationResult.ok) {
      setFormError(mutationResult.message);
      toast.error(mutationResult.message);
      return;
    }

    if (mode === "create") {
      toast.success(`Документ ${mutationResult.data.docNo} создан`);
    } else {
      toast.success("Черновик обновлен");
    }

    onSuccess?.(mutationResult.data);
    reset(values);
  }

  function handleReset() {
    reset(defaultValues);
  }

  return (
    <form
      id={resolvedFormId}
      onSubmit={handleSubmit(handleFormSubmit)}
      onReset={(event) => {
        event.preventDefault();
        handleReset();
      }}
      className="space-y-6"
    >
      <FieldGroup>
        {definition.sections.map((section, sectionIndex) => {
          const sectionRows = resolveDocumentFormSectionRows(section);
          const hiddenSectionCurrencyField = section.fields.find(
            (field) =>
              field.kind === "currency" &&
              field.hidden &&
              isFieldVisible(field, watchedValues),
          );
          const hiddenSectionCurrencyCode = hiddenSectionCurrencyField
            ? readValueAsString(watchedValues?.[hiddenSectionCurrencyField.name])
                .trim()
                .toUpperCase()
            : "";

          return (
            <Fragment key={section.id}>
              {sectionIndex > 0 ? <FieldSeparator /> : null}
              <FieldSet>
              <FieldLegend>{section.title}</FieldLegend>
              {section.description ? (
                <FieldDescription>{section.description}</FieldDescription>
              ) : null}
              <FieldGroup>
                  {sectionRows.map((row, rowIndex) => {
                    const visibleRowFields = row.fields.filter(
                      ({ field }) =>
                        !field.hidden && isFieldVisible(field, watchedValues),
                    );

                    if (visibleRowFields.length === 0) {
                      return null;
                    }

                    return (
                      <div
                        key={`${section.id}-row-${rowIndex}`}
                        className={getResponsiveGridClassName(row.columns)}
                      >
                        {visibleRowFields.map(({ field, span }) => {
                        const errorMessage = fieldErrorMessage(errors, field.name);
                        const fieldClassName = getResponsiveGridItemClassName(span);

                        if (field.kind === "textarea") {
                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Textarea
                                id={`document-field-${field.name}`}
                                rows={field.rows ?? 3}
                                placeholder={field.placeholder}
                                disabled={disabled || submitting}
                                {...register(field.name)}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "enum") {
                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
                                  <Select
                                    value={readValueAsString(controlledField.value)}
                                    disabled={disabled || submitting}
                                    onValueChange={(value) => controlledField.onChange(value)}
                                  >
                                    <SelectTrigger id={`document-field-${field.name}`}>
                                      <SelectValue placeholder="Выберите значение">
                                        {findSelectedLabel(
                                          controlledField.value,
                                          field.options,
                                        )}
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
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "currency") {
                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
                                  <Select
                                    value={readValueAsString(controlledField.value)}
                                    disabled={disabled || submitting}
                                    onValueChange={(value) => controlledField.onChange(value)}
                                  >
                                    <SelectTrigger id={`document-field-${field.name}`}>
                                      <SelectValue placeholder="Выберите валюту">
                                        {findSelectedLabel(
                                          controlledField.value,
                                          currencySelectOptions,
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.currencies.map((option) => (
                                        <SelectItem key={option.id} value={option.code}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "counterparty") {
                          const ownerSource = resolveOwnerFieldSource(field);
                          const ownerOptions =
                            ownerSource === "organizations"
                              ? options.organizations
                              : options.counterparties;
                          const ownerSelectOptions =
                            ownerSource === "organizations"
                              ? organizationSelectOptions
                              : counterpartySelectOptions;
                          const ownerNoun =
                            ownerSource === "organizations"
                              ? "организацию"
                              : "контрагента";

                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
                                  <Select
                                    value={readValueAsString(controlledField.value)}
                                    disabled={disabled || submitting}
                                    onValueChange={(value) => {
                                      controlledField.onChange(value);
                                      resetDependentAccountFields(field.name);
                                    }}
                                  >
                                    <SelectTrigger id={`document-field-${field.name}`}>
                                      <SelectValue placeholder={`Выберите ${ownerNoun}`}>
                                        {findSelectedLabel(
                                          controlledField.value,
                                          ownerSelectOptions,
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ownerOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "customer") {
                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
                                  <Select
                                    value={readValueAsString(controlledField.value)}
                                    disabled={disabled || submitting}
                                    onValueChange={(value) =>
                                      controlledField.onChange(value)
                                    }
                                  >
                                    <SelectTrigger id={`document-field-${field.name}`}>
                                      <SelectValue placeholder="Выберите клиента">
                                        {findSelectedLabel(
                                          controlledField.value,
                                          customerSelectOptions,
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.customers.map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "account") {
                          const ownerId = readValueAsString(
                            watchedValues?.[field.counterpartyField],
                          ).trim();
                          const requisiteSource = resolveRequisiteFieldSource(field);
                          const ownerKey = resolveOwnerKey({
                            ownerId,
                            requisiteSource,
                          });
                          const accountOptions = isUuid(ownerId)
                            ? (requisitesByOwnerKey.get(ownerKey) ?? [])
                            : [];
                          const isLoading = loadingOwnerKeys.has(ownerKey);
                          const hasOwner = isUuid(ownerId);
                          const ownerNoun =
                            requisiteSource === "organizationRequisites"
                              ? "организацию"
                              : "контрагента";
                          const accountSelectOptions = accountOptions.map((option) => ({
                            value: option.id,
                            label: option.label,
                          }));

                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
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
                                    onValueChange={(value) =>
                                      controlledField.onChange(value)
                                    }
                                  >
                                    <SelectTrigger id={`document-field-${field.name}`}>
                                      <SelectValue
                                        placeholder={
                                          !hasOwner
                                            ? `Сначала выберите ${ownerNoun}`
                                            : isLoading
                                              ? "Загрузка реквизитов..."
                                              : "Выберите реквизит"
                                        }
                                      >
                                        {findSelectedLabel(
                                          controlledField.value,
                                          accountSelectOptions,
                                        )}
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
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "number") {
                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : null}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
                                  <Input
                                    id={`document-field-${field.name}`}
                                    type="number"
                                    min={field.min}
                                    step={field.step ?? 1}
                                    value={readValueAsString(controlledField.value)}
                                    placeholder={field.placeholder}
                                    disabled={disabled || submitting}
                                    onChange={(event) =>
                                      controlledField.onChange(event.target.value)
                                    }
                                  />
                                )}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "amount") {
                          const showDerivedCurrencyAddon = Boolean(
                            hiddenSectionCurrencyField,
                          );

                          return (
                            <Field
                              key={field.name}
                              className={fieldClassName}
                              data-invalid={Boolean(errorMessage)}
                            >
                              <FieldLabel htmlFor={`document-field-${field.name}`}>
                                {field.label}
                              </FieldLabel>
                              {field.description ? (
                                <FieldDescription>{field.description}</FieldDescription>
                              ) : (
                                <FieldDescription>
                                  Введите сумму в основных единицах, например `1000.50`.
                                </FieldDescription>
                              )}
                              <Controller
                                control={control}
                                name={field.name}
                                render={({ field: controlledField }) => (
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
                                        onChange={(event) =>
                                          controlledField.onChange(event.target.value)
                                        }
                                      />
                                      <InputGroupAddon align="inline-end">
                                        <InputGroupText>
                                          {hiddenSectionCurrencyCode || "..."}
                                        </InputGroupText>
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
                                      onChange={(event) =>
                                        controlledField.onChange(event.target.value)
                                      }
                                    />
                                  )
                                )}
                              />
                              {errorMessage ? (
                                <p className="text-sm text-destructive">{errorMessage}</p>
                              ) : null}
                            </Field>
                          );
                        }

                        if (field.kind === "financialLines") {
                          return (
                            <FinancialLinesField
                              key={field.name}
                              control={control}
                              setValue={setValue}
                              field={field}
                              currencySelectOptions={currencySelectOptions}
                              disabled={disabled}
                              submitting={submitting}
                              errors={errors}
                              className={fieldClassName}
                            />
                          );
                        }

                        if (field.kind === "fxQuotePreview") {
                          return (
                            <FxQuotePreviewField
                              key={field.name}
                              control={control}
                              field={field}
                              disabled={disabled}
                              submitting={submitting}
                              className={fieldClassName}
                            />
                          );
                        }

                        const inputType =
                          field.kind === "datetime"
                            ? "datetime-local"
                            : field.kind === "date"
                              ? "date"
                              : field.kind === "month"
                                ? "month"
                                : "text";

                        return (
                          <Field
                            key={field.name}
                            className={fieldClassName}
                            data-invalid={Boolean(errorMessage)}
                          >
                            <FieldLabel htmlFor={`document-field-${field.name}`}>
                              {field.label}
                            </FieldLabel>
                            {field.description ? (
                              <FieldDescription>{field.description}</FieldDescription>
                            ) : null}
                            <Input
                              id={`document-field-${field.name}`}
                              type={inputType}
                              placeholder={field.placeholder}
                              disabled={disabled || submitting}
                              {...register(field.name)}
                            />
                            {errorMessage ? (
                              <p className="text-sm text-destructive">{errorMessage}</p>
                            ) : null}
                          </Field>
                        );
                      })}
                    </div>
                    );
                  })}
                </FieldGroup>
              </FieldSet>
            </Fragment>
          );
        })}
      </FieldGroup>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      {actionsPlacement === "footer" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitDisabled}>
            {submitting ? (
              <Spinner className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {submitting ? submittingLabel : submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resetDisabled}
            onClick={handleReset}
          >
            <X className="size-4" />
            Отменить
          </Button>
        </div>
      ) : null}
    </form>
  );
}
