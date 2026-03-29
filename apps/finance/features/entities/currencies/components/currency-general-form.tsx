"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, Save, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  LIST_CURRENCIES,
  KNOWN_CURRENCY_CODES,
  getKnownCurrency,
  getDefaultPrecision,
} from "@bedrock/currencies";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/sdk-ui/components/command";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

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
  isEditMode: boolean;
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
  code: z
    .string()
    .trim()
    .min(1, "Код валюты обязателен")
    .refine(
      (c) => KNOWN_CURRENCY_CODES.has(c.toUpperCase()),
      "Неизвестный код валюты",
    ),
  symbol: z.string().trim().min(1, "Символ валюты обязателен"),
  precision: z.number().int().min(0, "Точность не может быть меньше 0"),
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
  isEditMode: false,
};

const EDIT_GENERAL_FORM_VARIANT: CurrencyGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
  isEditMode: true,
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
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CurrencyGeneralFormValues>({
    resolver: zodResolver(CurrencyGeneralFormSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const watchedName = watchedValues?.name ?? "";
  const watchedCode = watchedValues?.code ?? "";

  const selectedCurrency = useMemo(
    () => (watchedCode ? getKnownCurrency(watchedCode) : undefined),
    [watchedCode],
  );

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

  function handleCurrencySelect(code: string) {
    const currency = getKnownCurrency(code);
    if (!currency) return;

    setValue("code", currency.code, { shouldValidate: true });
    setValue("name", currency.name, { shouldValidate: true });
    setValue("symbol", currency.symbol, { shouldValidate: true });
    setValue("precision", getDefaultPrecision(currency.code), {
      shouldValidate: true,
    });
    setComboboxOpen(false);
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
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
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
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={deleteDisabled}
                  />
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
                {variant.isEditMode ? (
                  <Field>
                    <FieldLabel htmlFor="currency-code">Код</FieldLabel>
                    <Input
                      id="currency-code"
                      value={watchedCode}
                      disabled
                      readOnly
                    />
                  </Field>
                ) : (
                  <Field data-invalid={Boolean(errors.code)}>
                    <FieldLabel>Валюта</FieldLabel>
                    <input type="hidden" {...register("code")} />
                    <Popover
                      open={comboboxOpen}
                      onOpenChange={setComboboxOpen}
                    >
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            role="combobox"
                            aria-expanded={comboboxOpen}
                            aria-invalid={Boolean(errors.code)}
                            className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex h-8 w-full items-center justify-between rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:ring-3 aria-invalid:ring-3"
                          >
                            {selectedCurrency ? (
                              <span className="flex items-center gap-2 truncate">
                                <span className="font-medium">
                                  {selectedCurrency.code}
                                </span>
                                <span className="text-muted-foreground truncate">
                                  {selectedCurrency.name}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                Выберите валюту...
                              </span>
                            )}
                            <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0" />
                          </button>
                        }
                      />
                      <PopoverContent
                        className="w-72 p-0"
                        align="start"
                        sideOffset={4}
                      >
                        <Command>
                          <CommandInput placeholder="Поиск по коду или названию..." />
                          <CommandList>
                            <CommandEmpty>Валюта не найдена.</CommandEmpty>
                            <CommandGroup>
                              {LIST_CURRENCIES.map((currency) => (
                                <CommandItem
                                  key={currency.code}
                                  value={`${currency.code} ${currency.name}`}
                                  data-checked={
                                    watchedCode === currency.code || undefined
                                  }
                                  onSelect={() =>
                                    handleCurrencySelect(currency.code)
                                  }
                                >
                                  <span className="w-10 shrink-0 font-medium">
                                    {currency.code}
                                  </span>
                                  <span className="text-muted-foreground truncate">
                                    {currency.name}
                                  </span>
                                  <span className="text-muted-foreground ml-auto shrink-0">
                                    {currency.symbol}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FieldError errors={[errors.code]} />
                  </Field>
                )}
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
                        readOnly={!variant.isEditMode}
                        disabled={!variant.isEditMode && !selectedCurrency}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Field data-invalid={Boolean(errors.symbol)}>
                  <FieldLabel htmlFor="currency-symbol">Символ</FieldLabel>
                  <Input
                    {...register("symbol")}
                    id="currency-symbol"
                    aria-invalid={Boolean(errors.symbol)}
                    placeholder="Например: $"
                    readOnly={!variant.isEditMode}
                    disabled={!variant.isEditMode && !selectedCurrency}
                  />
                  <FieldError errors={[errors.symbol]} />
                </Field>
                <Field data-invalid={Boolean(errors.precision)}>
                  <FieldLabel htmlFor="currency-precision">
                    Точность
                  </FieldLabel>
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
    <CurrencyGeneralFormBase variant={EDIT_GENERAL_FORM_VARIANT} {...props} />
  );
}
