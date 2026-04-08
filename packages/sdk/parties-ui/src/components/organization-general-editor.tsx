"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

const ORGANIZATION_COUNTRY_OPTIONS = [
  "AE",
  "AM",
  "BY",
  "CN",
  "CY",
  "DE",
  "GB",
  "GE",
  "HK",
  "IN",
  "KZ",
  "KG",
  "RU",
  "SG",
  "TR",
  "UA",
  "US",
] as const;

const ORGANIZATION_COUNTRY_CODE_SET = new Set<string>(
  ORGANIZATION_COUNTRY_OPTIONS,
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

type OrganizationGeneralEditorProps = {
  initialValues?: Partial<OrganizationGeneralFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  error?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  onValuesChange?: (values: OrganizationGeneralFormValues) => void;
  onSubmit?: (
    values: OrganizationGeneralFormValues,
  ) => OrganizationGeneralFormSubmit;
  onShortNameChange?: (name: string) => void;
  submitLabel?: string;
  submittingLabel?: string;
  disableSubmitUntilDirty?: boolean;
  kindReadonly?: boolean;
  headerActions?: ReactNode;
  showDates?: boolean;
  title?: string;
  description?: string;
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

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OrganizationGeneralEditor({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  error,
  onDirtyChange,
  onValuesChange,
  onSubmit,
  onShortNameChange,
  submitLabel = "Сохранить",
  submittingLabel = "Сохранение...",
  disableSubmitUntilDirty = true,
  kindReadonly = false,
  headerActions,
  showDates = true,
  title = "Общая информация",
  description = "Просмотр и редактирование общей информации организации.",
}: OrganizationGeneralEditorProps) {
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
  const watchedValues = useWatch({
    control,
  });

  useEffect(() => {
    reset(resolvedInitialValues);
  }, [reset, resolvedInitialValues]);

  useEffect(() => {
    onShortNameChange?.(watchedShortName ?? "");
  }, [onShortNameChange, watchedShortName]);

  useEffect(() => {
    onValuesChange?.({
      ...DEFAULT_VALUES,
      ...watchedValues,
    });
  }, [onValuesChange, watchedValues]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    submitting || !onSubmit || (disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
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
              {submitting ? submittingLabel : submitLabel}
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
            {headerActions}
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
                          disabled={kindReadonly || submitting}
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
                        <CountrySelect
                          id="organization-country"
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={submitting}
                          invalid={fieldState.invalid}
                          placeholder="Выберите страну"
                          searchPlaceholder="Поиск страны..."
                          emptyLabel="Страна не найдена"
                          clearable
                          clearLabel="Очистить"
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
            {showDates ? (
              <>
                <FieldSeparator />
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Дата создания</FieldLabel>
                    <Input readOnly disabled value={formatDateLabel(createdAt)} />
                  </Field>
                  <Field>
                    <FieldLabel>Дата обновления</FieldLabel>
                    <Input readOnly disabled value={formatDateLabel(updatedAt)} />
                  </Field>
                </div>
              </>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
