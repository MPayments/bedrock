"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ZodError } from "zod";

import { Button } from "@bedrock/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { Spinner } from "@bedrock/ui/components/spinner";
import { Textarea } from "@bedrock/ui/components/textarea";
import { toast } from "@bedrock/ui/components/sonner";

import type { UserRole } from "@/lib/auth/types";
import { isUuid } from "@/lib/resources/http";
import {
  fetchCounterpartyAccountOptions,
  type CounterpartyAccountOption,
} from "@/features/documents/lib/account-options";
import {
  getDocumentFormDefinitionForRole,
  type DocumentFormField,
} from "@/features/documents/lib/document-form-registry";
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
};

function fieldErrorMessage(
  errors: Record<string, { message?: unknown } | undefined>,
  fieldName: string,
): string | null {
  const raw = errors[fieldName]?.message;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }

  return null;
}

function isAccountField(field: DocumentFormField): field is Extract<DocumentFormField, { kind: "account" }> {
  return field.kind === "account";
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
}: DocumentTypedFormProps) {
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
  const [accountsByCounterpartyId, setAccountsByCounterpartyId] = useState(
    new Map<string, CounterpartyAccountOption[]>(),
  );
  const [loadingCounterpartyIds, setLoadingCounterpartyIds] = useState(
    new Set<string>(),
  );
  const loadingIdsRef = useRef(new Set<string>());

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

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (!definition || accountFields.length === 0) {
      return;
    }

    for (const field of accountFields) {
      const counterpartyId = readValueAsString(
        watchedValues?.[field.counterpartyField],
      ).trim();

      if (!isUuid(counterpartyId)) {
        continue;
      }

      if (
        accountsByCounterpartyId.has(counterpartyId) ||
        loadingIdsRef.current.has(counterpartyId)
      ) {
        continue;
      }

      loadingIdsRef.current.add(counterpartyId);
      setLoadingCounterpartyIds(
        (current) => new Set([...current, counterpartyId]),
      );

      fetchCounterpartyAccountOptions({
        counterpartyId,
        currencyLabelById,
      })
        .then((accountOptions) => {
          setAccountsByCounterpartyId((current) => {
            const next = new Map(current);
            next.set(counterpartyId, accountOptions);
            return next;
          });
        })
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить счета контрагента",
          );
        })
        .finally(() => {
          loadingIdsRef.current.delete(counterpartyId);
          setLoadingCounterpartyIds((current) => {
            const next = new Set(current);
            next.delete(counterpartyId);
            return next;
          });
        });
    }
  }, [accountFields, accountsByCounterpartyId, currencyLabelById, definition, watchedValues]);

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
      const fieldName = issue.path[0];
      if (typeof fieldName !== "string" || fieldName.length === 0) {
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

  const submitDisabled =
    disabled ||
    submitting ||
    (mode === "edit" && (!documentId || !isDirty));
  const resetDisabled = disabled || submitting || !isDirty;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <FieldGroup>
        {definition.sections.map((section) => (
          <FieldSet key={section.id}>
            <div className="space-y-1">
              <p className="text-sm font-medium">{section.title}</p>
              {section.description ? (
                <p className="text-muted-foreground text-sm">{section.description}</p>
              ) : null}
            </div>
            <FieldGroup>
              {section.fields.map((field) => {
                const errorMessage = fieldErrorMessage(
                  errors as Record<string, { message?: unknown } | undefined>,
                  field.name,
                );

                if (field.kind === "textarea") {
                  return (
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                              <SelectValue placeholder="Выберите значение" />
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
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                              <SelectValue placeholder="Выберите валюту" />
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
                  return (
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                              <SelectValue placeholder="Выберите контрагента" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.counterparties.map((option) => (
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
                  const counterpartyId = readValueAsString(
                    watchedValues?.[field.counterpartyField],
                  ).trim();
                  const accountOptions = isUuid(counterpartyId)
                    ? (accountsByCounterpartyId.get(counterpartyId) ?? [])
                    : [];
                  const isLoading = loadingCounterpartyIds.has(counterpartyId);
                  const hasCounterparty = isUuid(counterpartyId);

                  return (
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                              !hasCounterparty ||
                              isLoading ||
                              accountOptions.length === 0
                            }
                            onValueChange={(value) => controlledField.onChange(value)}
                          >
                            <SelectTrigger id={`document-field-${field.name}`}>
                              <SelectValue
                                placeholder={
                                  !hasCounterparty
                                    ? "Сначала выберите контрагента"
                                    : isLoading
                                      ? "Загрузка счетов..."
                                      : "Выберите счет"
                                }
                              />
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
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                            onChange={(event) => controlledField.onChange(event.target.value)}
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
                  return (
                    <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
                        )}
                      />
                      {errorMessage ? (
                        <p className="text-sm text-destructive">{errorMessage}</p>
                      ) : null}
                    </Field>
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
                  <Field key={field.name} data-invalid={Boolean(errorMessage)}>
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
            </FieldGroup>
          </FieldSet>
        ))}
      </FieldGroup>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitDisabled}>
          {submitting ? <Spinner className="size-4" /> : <Save className="size-4" />}
          {submitting ? submittingLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={resetDisabled}
          onClick={() => reset(defaultValues)}
        >
          <X className="size-4" />
          Отменить
        </Button>
      </div>
    </form>
  );
}
