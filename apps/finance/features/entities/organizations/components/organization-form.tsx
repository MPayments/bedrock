"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Save, X } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/sdk-ui/components/command";
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

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";
import {
  COUNTERPARTY_COUNTRY_OPTIONS,
  getCountryPresentation,
} from "@/features/entities/counterparties/lib/countries";
import { formatDate } from "@/lib/format";

const ORGANIZATION_COUNTRY_CODE_SET = new Set(
  COUNTERPARTY_COUNTRY_OPTIONS.map((option) => option.value),
);

const OrganizationGeneralFormSchema = z.object({
  shortName: z.string().trim().min(1, "Краткое наименование обязательно"),
  fullName: z.string().trim().min(1, "Полное наименование обязательно"),
  kind: z.enum(["legal_entity", "individual"]),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => value.length === 0 || ORGANIZATION_COUNTRY_CODE_SET.has(value),
      "Выберите страну из списка",
    ),
  externalId: z.string().trim(),
  description: z.string().trim(),
});

export type OrganizationGeneralFormValues = z.infer<
  typeof OrganizationGeneralFormSchema
>;

type OrganizationGeneralFormSubmit =
  | Promise<OrganizationGeneralFormValues | void>
  | OrganizationGeneralFormValues
  | void;

type OrganizationGeneralFormDelete = Promise<boolean | void> | boolean | void;

type OrganizationGeneralFormProps = {
  initialValues?: Partial<OrganizationGeneralFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: OrganizationGeneralFormValues,
  ) => OrganizationGeneralFormSubmit;
  onDelete?: () => OrganizationGeneralFormDelete;
  onShortNameChange?: (name: string) => void;
};

type OrganizationGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  showDelete: boolean;
  usePlaceholderDates: boolean;
};

type OrganizationGeneralFormBaseProps = OrganizationGeneralFormProps & {
  variant: OrganizationGeneralFormVariant;
};

const DEFAULT_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalId: "",
  description: "",
};

const ORGANIZATION_KIND_OPTIONS = [
  { value: "legal_entity", label: "Юридическое лицо" },
  { value: "individual", label: "Физическое лицо" },
] as const satisfies ReadonlyArray<{
  value: OrganizationGeneralFormValues["kind"];
  label: string;
}>;

const CREATE_GENERAL_FORM_VARIANT: OrganizationGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
  usePlaceholderDates: true,
};

const EDIT_GENERAL_FORM_VARIANT: OrganizationGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
  usePlaceholderDates: false,
};

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "—";
}

function OrganizationGeneralFormBase({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onShortNameChange,
  variant,
}: OrganizationGeneralFormBaseProps) {
  const resolvedInitialValues = useMemo(
    () => ({ ...DEFAULT_VALUES, ...initialValues }),
    [initialValues],
  );

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<OrganizationGeneralFormValues>({
    resolver: zodResolver(OrganizationGeneralFormSchema),
    defaultValues: resolvedInitialValues,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedShortName = useWatch({
    control,
    name: "shortName",
  });
  const selectedCountryCode = useWatch({
    control,
    name: "country",
  });
  const selectedCountry = useMemo(
    () => getCountryPresentation(selectedCountryCode),
    [selectedCountryCode],
  );
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    reset(resolvedInitialValues);
  }, [reset, resolvedInitialValues]);

  useEffect(() => {
    onShortNameChange?.(watchedShortName ?? "");
  }, [onShortNameChange, watchedShortName]);

  async function handleFormSubmit(values: OrganizationGeneralFormValues) {
    if (!onSubmit) {
      return;
    }

    const submittedValues = await onSubmit(values);

    if (submittedValues) {
      reset(submittedValues);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;
  const deleteDisabled = deleting || submitting || !onDelete;
  const createdAtLabel = variant.usePlaceholderDates
    ? "—"
    : formatOptionalDate(createdAt);
  const updatedAtLabel = variant.usePlaceholderDates
    ? "—"
    : formatOptionalDate(updatedAt);

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации организации.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="organization-general-form"
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
              onClick={() => reset(resolvedInitialValues)}
            >
              <X className="size-4" />
              Отменить
            </Button>
            {variant.showDelete ? (
              <EntityDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                deleting={deleting}
                onDelete={() => onDelete?.()}
                disableDelete={submitting}
                title="Удалить организацию?"
                description="Организация будет удалена без возможности восстановления."
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
          id="organization-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Controller
                    name="shortName"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-short-name">
                          Краткое наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="organization-short-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Bedrock"
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Controller
                    name="fullName"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-full-name">
                          Полное наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="organization-full-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Bedrock Holdings Limited"
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Controller
                    name="kind"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-kind">
                          Тип субъекта
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="organization-kind"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите тип">
                              {
                                ORGANIZATION_KIND_OPTIONS.find(
                                  (option) => option.value === field.value,
                                )?.label
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {ORGANIZATION_KIND_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
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
                  <Controller
                    name="country"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-country">
                          Страна
                        </FieldLabel>
                        <Popover
                          open={countryPickerOpen}
                          onOpenChange={setCountryPickerOpen}
                        >
                          <PopoverTrigger
                            render={
                              <Button
                                id="organization-country"
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
                                  {COUNTERPARTY_COUNTRY_OPTIONS.map((option) => (
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
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Controller
                    name="externalId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-external-id">
                          Внешний ID
                        </FieldLabel>
                        <Input
                          {...field}
                          id="organization-external-id"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.description)}>
                    <FieldLabel htmlFor="organization-description">
                      Описание
                    </FieldLabel>
                    <FieldDescription>
                      Дополнительная информация об организации
                    </FieldDescription>
                    <Textarea
                      {...register("description")}
                      id="organization-description"
                      aria-invalid={Boolean(errors.description)}
                      rows={3}
                    />
                    <FieldError errors={[errors.description]} />
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input readOnly disabled value={createdAtLabel} />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input readOnly disabled value={updatedAtLabel} />
              </Field>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function OrganizationCreateGeneralForm(
  props: OrganizationGeneralFormProps,
) {
  return (
    <OrganizationGeneralFormBase
      variant={CREATE_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

export function OrganizationEditGeneralForm(
  props: OrganizationGeneralFormProps,
) {
  return (
    <OrganizationGeneralFormBase
      variant={EDIT_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}
