"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import { Spinner } from "@bedrock/ui/components/spinner";

import { CurrencyDeleteDialog } from "./currency-delete-dialog";

export type CurrencyGeneralFormValues = {
  name: string;
  code: string;
  symbol: string;
  precision: number;
};

type CurrencyGeneralFormSubmit =
  | Promise<CurrencyGeneralFormValues | void>
  | CurrencyGeneralFormValues
  | void;

type CurrencyGeneralFormDelete = Promise<boolean | void> | boolean | void;

type CurrencyGeneralFormProps = {
  initialValues?: Partial<CurrencyGeneralFormValues>;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: CurrencyGeneralFormValues) => CurrencyGeneralFormSubmit;
  onDelete?: () => CurrencyGeneralFormDelete;
  onNameChange?: (name: string) => void;
};

type CurrencyGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  showDelete: boolean;
};

type CurrencyGeneralFormBaseProps = CurrencyGeneralFormProps & {
  variant: CurrencyGeneralFormVariant;
};

const DEFAULT_VALUES: CurrencyGeneralFormValues = {
  name: "",
  code: "",
  symbol: "",
  precision: 2,
};

const CurrencyGeneralFormSchema = z.object({
  name: z.string().trim().min(1, "Название валюты обязательно"),
  code: z.string().trim().min(1, "Код валюты обязателен"),
  symbol: z.string().trim().min(1, "Символ валюты обязателен"),
  precision: z
    .number()
    .int()
    .min(0, "Точность не может быть меньше 0"),
});

function resolveInitialValues(
  initialValues?: Partial<CurrencyGeneralFormValues>,
): CurrencyGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

function normalizeValues(
  values: CurrencyGeneralFormValues,
): CurrencyGeneralFormValues {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    symbol: values.symbol.trim(),
    precision: values.precision,
  };
}

function valuesSignature(values: CurrencyGeneralFormValues) {
  return `${values.name}\n${values.code}\n${values.symbol}\n${values.precision}`;
}

const CREATE_GENERAL_FORM_VARIANT: CurrencyGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
};

const EDIT_GENERAL_FORM_VARIANT: CurrencyGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
};

function CurrencyGeneralFormBase({
  initialValues,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onNameChange,
  variant,
}: CurrencyGeneralFormBaseProps) {
  const initial = useMemo(
    () => normalizeValues(resolveInitialValues(initialValues)),
    [initialValues],
  );
  const initialSignature = useMemo(() => valuesSignature(initial), [initial]);
  const appliedInitialSignatureRef = useRef(initialSignature);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<CurrencyGeneralFormValues>({
    resolver: zodResolver(CurrencyGeneralFormSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const watchedName = watchedValues?.name ?? "";

  const currentValues = useMemo(
    () =>
      normalizeValues({
        name: watchedValues?.name ?? "",
        code: watchedValues?.code ?? "",
        symbol: watchedValues?.symbol ?? "",
        precision: watchedValues?.precision ?? 0,
      }),
    [
      watchedValues?.code,
      watchedValues?.name,
      watchedValues?.precision,
      watchedValues?.symbol,
    ],
  );

  const isChanged = useMemo(
    () => valuesSignature(currentValues) !== initialSignature,
    [currentValues, initialSignature],
  );

  useEffect(() => {
    if (appliedInitialSignatureRef.current !== initialSignature) {
      reset(initial);
      appliedInitialSignatureRef.current = initialSignature;
    }
  }, [initial, initialSignature, reset]);

  useEffect(() => {
    onNameChange?.(watchedName);
  }, [onNameChange, watchedName]);

  function handleReset() {
    reset(initial);
  }

  async function handleFormSubmit(values: CurrencyGeneralFormValues) {
    if (!onSubmit) return;

    const submittedValues = await onSubmit(normalizeValues(values));
    if (submittedValues) {
      const normalizedSubmitted = normalizeValues(submittedValues);
      reset(normalizedSubmitted);
      appliedInitialSignatureRef.current = valuesSignature(normalizedSubmitted);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const result = await onDelete();
    if (result !== false) {
      setDeleteDialogOpen(false);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isChanged);
  const resetDisabled = submitting || !isChanged;
  const deleteDisabled = deleting || submitting || !onDelete;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">Общая информация</CardTitle>
            <CardDescription>
              Просмотр и редактирование параметров валюты.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="currency-general-form"
              disabled={submitDisabled}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? variant.submittingLabel : variant.submitLabel}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={resetDisabled}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
            {variant.showDelete ? (
              <CurrencyDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                deleting={deleting}
                onDelete={handleDelete}
                disableDelete={deleteDisabled}
                trigger={
                  <Button variant="destructive" type="button" disabled={deleteDisabled} />
                }
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="currency-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="currency-name">Название</FieldLabel>
                      <Input
                        {...field}
                        id="currency-name"
                        aria-invalid={fieldState.invalid}
                        placeholder="Например: US Dollar"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Field data-invalid={Boolean(errors.code)}>
                  <FieldLabel htmlFor="currency-code">Код</FieldLabel>
                  <Input
                    {...register("code")}
                    id="currency-code"
                    aria-invalid={Boolean(errors.code)}
                    placeholder="Например: USD"
                  />
                  <FieldError errors={[errors.code]} />
                </Field>
                <Field data-invalid={Boolean(errors.symbol)}>
                  <FieldLabel htmlFor="currency-symbol">Символ</FieldLabel>
                  <Input
                    {...register("symbol")}
                    id="currency-symbol"
                    aria-invalid={Boolean(errors.symbol)}
                    placeholder="Например: $"
                  />
                  <FieldError errors={[errors.symbol]} />
                </Field>
                <Field data-invalid={Boolean(errors.precision)}>
                  <FieldLabel htmlFor="currency-precision">Точность</FieldLabel>
                  <Input
                    {...register("precision", { valueAsNumber: true })}
                    id="currency-precision"
                    aria-invalid={Boolean(errors.precision)}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="2"
                  />
                  <FieldError errors={[errors.precision]} />
                </Field>
              </FieldGroup>
            </FieldSet>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function CurrencyCreateGeneralForm(props: CurrencyGeneralFormProps) {
  return (
    <CurrencyGeneralFormBase
      variant={CREATE_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

export function CurrencyEditGeneralForm(props: CurrencyGeneralFormProps) {
  return (
    <CurrencyGeneralFormBase
      variant={EDIT_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}
