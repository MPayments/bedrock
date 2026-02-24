"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Save, X } from "lucide-react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/ui/components/command";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { Spinner } from "@bedrock/ui/components/spinner";

import {
  PROVIDER_COUNTRY_OPTIONS,
  getCountryPresentation,
} from "../lib/countries";
import { ProviderDeleteDialog } from "./provider-delete-dialog";

export type ProviderGeneralFormValues = {
  name: string;
  type: "bank" | "exchange" | "blockchain" | "custodian";
  country: string;
  address: string;
  contact: string;
  bic: string;
  swift: string;
};

type ProviderGeneralFormSubmit =
  | Promise<ProviderGeneralFormValues | void>
  | ProviderGeneralFormValues
  | void;

type ProviderGeneralFormDelete = Promise<boolean | void> | boolean | void;

type ProviderGeneralFormProps = {
  initialValues?: Partial<ProviderGeneralFormValues>;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: ProviderGeneralFormValues) => ProviderGeneralFormSubmit;
  onDelete?: () => ProviderGeneralFormDelete;
  onNameChange?: (name: string) => void;
  typeReadonly?: boolean;
};

type ProviderGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  showDelete: boolean;
};

type ProviderGeneralFormBaseProps = ProviderGeneralFormProps & {
  variant: ProviderGeneralFormVariant;
};

const DEFAULT_VALUES: ProviderGeneralFormValues = {
  name: "",
  type: "bank",
  country: "",
  address: "",
  contact: "",
  bic: "",
  swift: "",
};

const PROVIDER_TYPE_OPTIONS = [
  { value: "bank", label: "Банк" },
  { value: "exchange", label: "Биржа" },
  { value: "blockchain", label: "Блокчейн" },
  { value: "custodian", label: "Кастодиан" },
] as const;

const COUNTRY_CODE_SET = new Set(
  PROVIDER_COUNTRY_OPTIONS.map((option) => option.value),
);

const ProviderGeneralFormSchema = z
  .object({
    name: z.string().trim().min(1, "Название обязательно"),
    type: z.enum(["bank", "exchange", "blockchain", "custodian"]),
    country: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine(
        (v) => v.length === 0 || COUNTRY_CODE_SET.has(v),
        "Выберите страну из списка",
      ),
    address: z.string(),
    contact: z.string(),
    bic: z.string(),
    swift: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.country) {
      ctx.addIssue({
        code: "custom",
        path: ["country"],
        message: "Страна обязательна",
      });
    }

    if (data.type === "bank") {
      if (data.country === "RU") {
        if (!data.bic.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["bic"],
            message: "БИК обязателен для российских банков",
          });
        }
      } else if (data.country) {
        if (!data.swift.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["swift"],
            message: "SWIFT обязателен для зарубежных банков",
          });
        }
        if (data.bic.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["bic"],
            message: "БИК не применим для зарубежных банков",
          });
        }
      }
    } else {
      if (data.bic.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["bic"],
          message: "БИК применим только для банков",
        });
      }
      if (data.swift.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["swift"],
          message: "SWIFT применим только для банков",
        });
      }
    }
  });

function resolveInitialValues(
  initialValues?: Partial<ProviderGeneralFormValues>,
): ProviderGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

function normalizeValues(
  values: ProviderGeneralFormValues,
): ProviderGeneralFormValues {
  return {
    name: values.name.trim(),
    type: values.type,
    country: values.country.trim().toUpperCase(),
    address: values.address.trim(),
    contact: values.contact.trim(),
    bic: values.bic.trim(),
    swift: values.swift.trim(),
  };
}

function valuesSignature(values: ProviderGeneralFormValues) {
  return `${values.name}\n${values.type}\n${values.country}\n${values.address}\n${values.contact}\n${values.bic}\n${values.swift}`;
}

const CREATE_VARIANT: ProviderGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
};

const EDIT_VARIANT: ProviderGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
};

function ProviderGeneralFormBase({
  initialValues,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onNameChange,
  typeReadonly = false,
  variant,
}: ProviderGeneralFormBaseProps) {
  const initial = useMemo(
    () => normalizeValues(resolveInitialValues(initialValues)),
    [initialValues],
  );
  const initialSignature = useMemo(() => valuesSignature(initial), [initial]);
  const appliedInitialSignatureRef = useRef(initialSignature);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<ProviderGeneralFormValues>({
    resolver: zodResolver(ProviderGeneralFormSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const watchedName = watchedValues?.name ?? "";
  const watchedType = watchedValues?.type ?? "bank";
  const watchedCountry = (watchedValues?.country ?? "").trim().toUpperCase();

  const showBicSwift = watchedType === "bank";
  const showBic = showBicSwift && watchedCountry === "RU";
  const showSwift = showBicSwift && watchedCountry !== "RU" && watchedCountry !== "";

  const selectedCountry = useMemo(
    () => getCountryPresentation(watchedCountry),
    [watchedCountry],
  );

  const currentValues = useMemo(
    () =>
      normalizeValues({
        name: watchedValues?.name ?? "",
        type: (watchedValues?.type as ProviderGeneralFormValues["type"]) ?? "bank",
        country: watchedValues?.country ?? "",
        address: watchedValues?.address ?? "",
        contact: watchedValues?.contact ?? "",
        bic: watchedValues?.bic ?? "",
        swift: watchedValues?.swift ?? "",
      }),
    [watchedValues],
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

  async function handleFormSubmit(values: ProviderGeneralFormValues) {
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
              Просмотр и редактирование параметров провайдера.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="provider-general-form"
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
              <ProviderDeleteDialog
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
          id="provider-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="name"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="provider-name">Название</FieldLabel>
                        <Input
                          {...field}
                          id="provider-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Сбербанк"
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Controller
                    name="type"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="provider-type">Тип</FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={typeReadonly}
                        >
                          <SelectTrigger
                            id="provider-type"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите тип">
                              {
                                PROVIDER_TYPE_OPTIONS.find(
                                  (o) => o.value === field.value,
                                )?.label
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {PROVIDER_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="country"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="provider-country">Страна</FieldLabel>
                        <Popover
                          open={countryPickerOpen}
                          onOpenChange={setCountryPickerOpen}
                        >
                          <PopoverTrigger
                            render={
                              <Button
                                id="provider-country"
                                type="button"
                                variant="outline"
                                className="w-full justify-between font-normal"
                                aria-invalid={fieldState.invalid}
                              />
                            }
                          >
                            <span className="truncate">
                              {selectedCountry?.label ??
                                (field.value
                                  ? field.value.trim().toUpperCase()
                                  : "Выберите страну")}
                            </span>
                            <ChevronDown className="text-muted-foreground size-4" />
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-(--anchor-width) p-0"
                          >
                            <Command>
                              <CommandInput placeholder="Поиск страны..." />
                              <CommandList className="max-h-64">
                                <CommandEmpty>Страна не найдена</CommandEmpty>
                                <CommandGroup>
                                  {PROVIDER_COUNTRY_OPTIONS.map((option) => (
                                    <CommandItem
                                      key={option.value}
                                      value={option.search}
                                      data-checked={
                                        field.value?.toUpperCase() === option.value
                                      }
                                      onSelect={() => {
                                        field.onChange(option.value);
                                        setCountryPickerOpen(false);
                                      }}
                                    >
                                      {option.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {field.value ? (
                                  <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                      <CommandItem
                                        onSelect={() => {
                                          field.onChange("");
                                          setCountryPickerOpen(false);
                                        }}
                                      >
                                        Очистить
                                      </CommandItem>
                                    </CommandGroup>
                                  </>
                                ) : null}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.contact)}>
                    <FieldLabel htmlFor="provider-contact">Контакт</FieldLabel>
                    <Input
                      {...register("contact")}
                      id="provider-contact"
                      aria-invalid={Boolean(errors.contact)}
                      placeholder="Контактные данные"
                    />
                    <FieldError errors={[errors.contact]} />
                  </Field>
                </div>

                <Field data-invalid={Boolean(errors.address)}>
                  <FieldLabel htmlFor="provider-address">Адрес</FieldLabel>
                  <Input
                    {...register("address")}
                    id="provider-address"
                    aria-invalid={Boolean(errors.address)}
                    placeholder="Адрес провайдера"
                  />
                  <FieldError errors={[errors.address]} />
                </Field>

                {showBicSwift ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {showBic || watchedCountry === "RU" ? (
                      <Field data-invalid={Boolean(errors.bic)}>
                        <FieldLabel htmlFor="provider-bic">БИК</FieldLabel>
                        <Input
                          {...register("bic")}
                          id="provider-bic"
                          aria-invalid={Boolean(errors.bic)}
                          placeholder="044525225"
                        />
                        <FieldError errors={[errors.bic]} />
                      </Field>
                    ) : null}
                    {showSwift ? (
                      <Field data-invalid={Boolean(errors.swift)}>
                        <FieldLabel htmlFor="provider-swift">SWIFT</FieldLabel>
                        <Input
                          {...register("swift")}
                          id="provider-swift"
                          aria-invalid={Boolean(errors.swift)}
                          placeholder="CHASUS33"
                        />
                        <FieldError errors={[errors.swift]} />
                      </Field>
                    ) : null}
                    {watchedCountry === "RU" ? (
                      <Field data-invalid={Boolean(errors.swift)}>
                        <FieldLabel htmlFor="provider-swift">SWIFT (опц.)</FieldLabel>
                        <Input
                          {...register("swift")}
                          id="provider-swift-optional"
                          aria-invalid={Boolean(errors.swift)}
                          placeholder="SABRRUMM"
                        />
                        <FieldError errors={[errors.swift]} />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </FieldGroup>
            </FieldSet>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProviderCreateGeneralForm(props: ProviderGeneralFormProps) {
  return <ProviderGeneralFormBase variant={CREATE_VARIANT} {...props} />;
}

export function ProviderEditGeneralForm(props: ProviderGeneralFormProps) {
  return (
    <ProviderGeneralFormBase
      variant={EDIT_VARIANT}
      typeReadonly
      {...props}
    />
  );
}
