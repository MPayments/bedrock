"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Save, Trash2, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/sdk-ui/components/command";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { formatDate } from "@/lib/format";

import {
  REQUISITE_KIND_OPTIONS,
  REQUISITE_OWNER_TYPE_OPTIONS,
  type RelationOption,
  type RequisiteFormValues,
  type RequisiteOwnerType,
} from "../lib/constants";

type RequisiteFormSubmit =
  | Promise<RequisiteFormValues | void>
  | RequisiteFormValues
  | void;

type RequisiteFormProps = {
  ownerType?: RequisiteOwnerType;
  ownerLabel: string;
  ownerDescription: string;
  ownerOptions: RelationOption[];
  ownerTypeReadonly?: boolean;
  providerOptions: RelationOption[];
  currencyOptions: RelationOption[];
  initialValues?: Partial<RequisiteFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: RequisiteFormValues) => RequisiteFormSubmit;
  onDelete?: () => Promise<boolean | void> | boolean | void;
  onLabelChange?: (label: string) => void;
  onOwnerTypeChange?: (ownerType: RequisiteOwnerType) => void;
  ownerReadonly?: boolean;
  kindReadonly?: boolean;
  deleteTitle?: string;
  deleteDescription?: string;
  submitLabel: string;
  submittingLabel: string;
  showDelete?: boolean;
};

const DEFAULT_VALUES: RequisiteFormValues = {
  ownerId: "",
  providerId: "",
  currencyId: "",
  kind: "bank",
  label: "",
  description: "",
  beneficiaryName: "",
  institutionName: "",
  institutionCountry: "",
  accountNo: "",
  corrAccount: "",
  iban: "",
  bic: "",
  swift: "",
  bankAddress: "",
  network: "",
  assetCode: "",
  address: "",
  memoTag: "",
  accountRef: "",
  subaccountRef: "",
  contact: "",
  notes: "",
  isDefault: false,
};

type SearchablePickerOption = {
  value: string;
  label: string;
  search: string;
};

function createSchema() {
  return z
    .object({
      ownerId: z.string().trim().min(1, "Владелец обязателен"),
      providerId: z.string().trim().min(1, "Провайдер обязателен"),
      currencyId: z.string().trim().min(1, "Валюта обязательна"),
      kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
      label: z.string().trim().min(1, "Название обязательно"),
      description: z.string(),
      beneficiaryName: z.string(),
      institutionName: z.string(),
      institutionCountry: z.string(),
      accountNo: z.string(),
      corrAccount: z.string(),
      iban: z.string(),
      bic: z.string(),
      swift: z.string(),
      bankAddress: z.string(),
      network: z.string(),
      assetCode: z.string(),
      address: z.string(),
      memoTag: z.string(),
      accountRef: z.string(),
      subaccountRef: z.string(),
      contact: z.string(),
      notes: z.string(),
      isDefault: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (data.kind === "bank") {
        if (!data.beneficiaryName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["beneficiaryName"],
            message: "Получатель обязателен для банковских реквизитов",
          });
        }
        if (!data.institutionName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionName"],
            message: "Банк обязателен для банковских реквизитов",
          });
        }
        if (!data.institutionCountry.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionCountry"],
            message: "Страна банка обязательна",
          });
        }
        if (!data.accountNo.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accountNo"],
            message: "Номер счёта обязателен",
          });
        }
      }

      if (data.kind === "blockchain") {
        if (!data.network.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["network"],
            message: "Сеть обязательна для блокчейн-реквизитов",
          });
        }
        if (!data.assetCode.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["assetCode"],
            message: "Актив обязателен для блокчейн-реквизитов",
          });
        }
        if (!data.address.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["address"],
            message: "Адрес обязателен для блокчейн-реквизитов",
          });
        }
      }

      if (data.kind === "exchange" || data.kind === "custodian") {
        if (!data.institutionName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionName"],
            message: "Институт обязателен",
          });
        }
        if (!data.institutionCountry.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionCountry"],
            message: "Страна института обязательна",
          });
        }
        if (!data.accountRef.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accountRef"],
            message: "Идентификатор аккаунта обязателен",
          });
        }
      }
    });
}

function normalizeValues(values: RequisiteFormValues): RequisiteFormValues {
  return {
    ownerId: values.ownerId.trim(),
    providerId: values.providerId.trim(),
    currencyId: values.currencyId.trim(),
    kind: values.kind,
    label: values.label.trim(),
    description: values.description.trim(),
    beneficiaryName: values.beneficiaryName.trim(),
    institutionName: values.institutionName.trim(),
    institutionCountry: values.institutionCountry.trim().toUpperCase(),
    accountNo: values.accountNo.trim(),
    corrAccount: values.corrAccount.trim(),
    iban: values.iban.trim(),
    bic: values.bic.trim(),
    swift: values.swift.trim(),
    bankAddress: values.bankAddress.trim(),
    network: values.network.trim(),
    assetCode: values.assetCode.trim(),
    address: values.address.trim(),
    memoTag: values.memoTag.trim(),
    accountRef: values.accountRef.trim(),
    subaccountRef: values.subaccountRef.trim(),
    contact: values.contact.trim(),
    notes: values.notes.trim(),
    isDefault: values.isDefault,
  };
}

function resolveInitialValues(
  initialValues?: Partial<RequisiteFormValues>,
): RequisiteFormValues {
  return { ...DEFAULT_VALUES, ...initialValues };
}

function toSearchableRelationOptions(
  options: RelationOption[],
): SearchablePickerOption[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label,
    search: `${option.label} ${option.id}`.toLowerCase(),
  }));
}

function SearchablePicker({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  invalid = false,
  clearable = false,
  fallbackLabel,
}: {
  value: string;
  onValueChange: (nextValue: string) => void;
  options: SearchablePickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  fallbackLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel =
    selectedOption?.label ?? fallbackLabel ?? (value ? value.trim() : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-invalid={invalid}
            disabled={disabled}
          />
        }
      >
        <span
          className={selectedOption || fallbackLabel || value ? "truncate" : "text-muted-foreground truncate"}
        >
          {displayLabel || placeholder}
        </span>
        <ChevronDown className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.search}
                  data-checked={value === option.value || undefined}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {clearable && value ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onValueChange("");
                      setOpen(false);
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
  );
}

export function RequisiteGeneralForm({
  ownerType,
  ownerLabel,
  ownerDescription,
  ownerOptions,
  ownerTypeReadonly = false,
  providerOptions,
  currencyOptions,
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onLabelChange,
  onOwnerTypeChange,
  ownerReadonly = false,
  kindReadonly = false,
  deleteTitle = "Удалить реквизит?",
  deleteDescription = "Реквизит будет удалён без возможности восстановления.",
  submitLabel,
  submittingLabel,
  showDelete = false,
}: RequisiteFormProps) {
  const schema = useMemo(() => createSchema(), []);
  const resolvedInitialValues = useMemo(
    () => resolveInitialValues(initialValues),
    [initialValues],
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ownerSelectOptions = useMemo(
    () => toSearchableRelationOptions(ownerOptions),
    [ownerOptions],
  );
  const providerSelectOptions = useMemo(
    () => toSearchableRelationOptions(providerOptions),
    [providerOptions],
  );
  const currencySelectOptions = useMemo(
    () => toSearchableRelationOptions(currencyOptions),
    [currencyOptions],
  );
  const form = useForm<RequisiteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: resolvedInitialValues,
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [form, resolvedInitialValues]);

  useEffect(() => {
    const ownerId = form.getValues("ownerId");

    if (!ownerId) {
      return;
    }

    const ownerExists = ownerOptions.some((option) => option.id === ownerId);

    if (!ownerExists) {
      form.setValue("ownerId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, ownerOptions]);

  const label = useWatch({ control: form.control, name: "label" });
  const kind = useWatch({ control: form.control, name: "kind" });

  useEffect(() => {
    onLabelChange?.(label ?? "");
  }, [label, onLabelChange]);

  async function handleFormSubmit(values: RequisiteFormValues) {
    const normalized = normalizeValues(values);
    const nextValues = await onSubmit?.(normalized);
    if (nextValues) {
      form.reset(nextValues);
      return;
    }
    form.reset(normalized);
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    setDeleteError(null);
    if (!window.confirm(`${deleteTitle}\n\n${deleteDescription}`)) {
      return;
    }
    const result = await onDelete();
    if (result === false) {
      setDeleteError("Не удалось удалить реквизит");
    }
  }

  const ownerTypeMissing =
    onOwnerTypeChange !== undefined && ownerType === undefined;
  const ownerSelectDisabled =
    submitting ||
    deleting ||
    ownerReadonly ||
    ownerType === undefined ||
    ownerOptions.length === 0;
  const submitDisabled = submitting || deleting || ownerTypeMissing;
  const resetDisabled = submitting || deleting || !form.formState.isDirty;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Общие сведения</CardTitle>
            <CardDescription>
              {createdAt || updatedAt
                ? `Создан ${createdAt ? formatDate(createdAt) : "—"} · Обновлён ${updatedAt ? formatDate(updatedAt) : "—"}`
                : "Настройте реквизит и проверьте владельца, валюту и провайдера перед созданием."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="requisite-general-form"
              disabled={submitDisabled}
            >
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? submittingLabel : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset(resolvedInitialValues)}
              disabled={resetDisabled}
            >
              <X className="h-4 w-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="requisite-general-form"
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6"
        >
          {(error || deleteError) && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error ?? deleteError}
            </div>
          )}

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Название</FieldLabel>
                <Input
                  {...form.register("label")}
                  placeholder="Например, Основной USD"
                  disabled={submitting || deleting}
                />
                <FieldError>{form.formState.errors.label?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Тип владельца</FieldLabel>
                <Select
                  value={ownerType}
                  onValueChange={(value) =>
                    onOwnerTypeChange?.(value as RequisiteOwnerType)
                  }
                  disabled={submitting || deleting || ownerTypeReadonly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип владельца">
                      {
                        REQUISITE_OWNER_TYPE_OPTIONS.find(
                          (option) => option.value === ownerType,
                        )?.label
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {REQUISITE_OWNER_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Организация или контрагент, которому принадлежат реквизиты.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>{ownerLabel}</FieldLabel>
                <Controller
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => (
                    <SearchablePicker
                      value={field.value}
                      onValueChange={field.onChange}
                      options={ownerSelectOptions}
                      placeholder={`Выберите ${ownerLabel.toLowerCase()}`}
                      searchPlaceholder={`Поиск ${ownerLabel.toLowerCase()}...`}
                      emptyLabel="Ничего не найдено"
                      disabled={ownerSelectDisabled}
                      invalid={Boolean(form.formState.errors.ownerId)}
                    />
                  )}
                />
                <FieldDescription>{ownerDescription}</FieldDescription>
                <FieldError>{form.formState.errors.ownerId?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Вид реквизита</FieldLabel>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting || kindReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите вид">
                          {
                            REQUISITE_KIND_OPTIONS.find(
                              (option) => option.value === field.value,
                            )?.label
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {REQUISITE_KIND_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.kind?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Валюта</FieldLabel>
                <Controller
                  control={form.control}
                  name="currencyId"
                  render={({ field }) => (
                    <SearchablePicker
                      value={field.value}
                      onValueChange={field.onChange}
                      options={currencySelectOptions}
                      placeholder="Выберите валюту"
                      searchPlaceholder="Поиск валюты..."
                      emptyLabel="Валюта не найдена"
                      disabled={submitting || deleting}
                      invalid={Boolean(form.formState.errors.currencyId)}
                    />
                  )}
                />
                <FieldError>{form.formState.errors.currencyId?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Провайдер</FieldLabel>
                <Controller
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <SearchablePicker
                      value={field.value}
                      onValueChange={field.onChange}
                      options={providerSelectOptions}
                      placeholder="Выберите провайдера"
                      searchPlaceholder="Поиск провайдера..."
                      emptyLabel="Провайдер не найден"
                      disabled={submitting || deleting}
                      invalid={Boolean(form.formState.errors.providerId)}
                    />
                  )}
                />
                <FieldError>{form.formState.errors.providerId?.message}</FieldError>
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Описание</FieldLabel>
                <Textarea
                  {...form.register("description")}
                  placeholder="Короткое описание или назначение"
                  disabled={submitting || deleting}
                  rows={3}
                />
                <FieldError>
                  {form.formState.errors.description?.message}
                </FieldError>
              </Field>

              <Field className="md:col-span-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-3">
                  <Controller
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        disabled={submitting || deleting}
                      />
                    )}
                  />
                  <div className="space-y-1">
                    <FieldLabel className="text-sm">Использовать по умолчанию</FieldLabel>
                    <FieldDescription>
                      Для выбранного владельца и валюты будет сохранён один дефолтный реквизит.
                    </FieldDescription>
                  </div>
                </div>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          {kind === "bank" && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Получатель</FieldLabel>
                  <Input
                    {...form.register("beneficiaryName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.beneficiaryName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Банк</FieldLabel>
                  <Input
                    {...form.register("institutionName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Страна банка</FieldLabel>
                  <Controller
                    control={form.control}
                    name="institutionCountry"
                    render={({ field }) => (
                      <CountrySelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите страну банка"
                        searchPlaceholder="Поиск страны..."
                        emptyLabel="Страна не найдена"
                        disabled={submitting || deleting}
                        invalid={Boolean(
                          form.formState.errors.institutionCountry,
                        )}
                        clearable
                        clearLabel="Очистить"
                      />
                    )}
                  />
                  <FieldError>
                    {form.formState.errors.institutionCountry?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Номер счёта</FieldLabel>
                  <Input
                    {...form.register("accountNo")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.accountNo?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Корр. счёт</FieldLabel>
                  <Input
                    {...form.register("corrAccount")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>IBAN</FieldLabel>
                  <Input
                    {...form.register("iban")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>BIC</FieldLabel>
                  <Input
                    {...form.register("bic")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>SWIFT</FieldLabel>
                  <Input
                    {...form.register("swift")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Адрес банка</FieldLabel>
                  <Textarea
                    {...form.register("bankAddress")}
                    rows={3}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          {kind === "blockchain" && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Сеть</FieldLabel>
                  <Input
                    {...form.register("network")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.network?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Актив</FieldLabel>
                  <Input
                    {...form.register("assetCode")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.assetCode?.message}</FieldError>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Адрес</FieldLabel>
                  <Textarea
                    {...form.register("address")}
                    rows={3}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.address?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Memo / Tag</FieldLabel>
                  <Input
                    {...form.register("memoTag")}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          {(kind === "exchange" || kind === "custodian") && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Институт</FieldLabel>
                  <Input
                    {...form.register("institutionName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Страна института</FieldLabel>
                  <Controller
                    control={form.control}
                    name="institutionCountry"
                    render={({ field }) => (
                      <CountrySelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите страну института"
                        searchPlaceholder="Поиск страны..."
                        emptyLabel="Страна не найдена"
                        disabled={submitting || deleting}
                        invalid={Boolean(
                          form.formState.errors.institutionCountry,
                        )}
                        clearable
                        clearLabel="Очистить"
                      />
                    )}
                  />
                  <FieldError>
                    {form.formState.errors.institutionCountry?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Account Ref</FieldLabel>
                  <Input
                    {...form.register("accountRef")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.accountRef?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Subaccount Ref</FieldLabel>
                  <Input
                    {...form.register("subaccountRef")}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          <FieldSeparator />

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Контакт</FieldLabel>
                <Textarea
                  {...form.register("contact")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>
              <Field>
                <FieldLabel>Примечание</FieldLabel>
                <Textarea
                  {...form.register("notes")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          {showDelete && onDelete ? (
            <div className="flex justify-start">
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={submitting || deleting}
              >
                {deleting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Удалить
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
