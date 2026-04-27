"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import type { Control, FieldPath } from "react-hook-form";
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
  shortNameEn: z.string(),
  fullName: z.string().trim().min(1, "Полное наименование обязательно"),
  fullNameEn: z.string(),
  kind: z.enum(["legal_entity", "individual"]),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => value.length === 0 || ORGANIZATION_COUNTRY_CODE_SET.has(value),
      "Выберите страну из списка",
    ),
  externalRef: z.string().trim(),
  description: z.string(),
});

export type OrganizationGeneralFormValues = z.infer<
  typeof OrganizationGeneralFormSchema
>;

export type OrganizationGeneralBilingualMode = "ru" | "en" | "all";

type OrganizationGeneralFormSubmit =
  | Promise<OrganizationGeneralFormValues | void>
  | OrganizationGeneralFormValues
  | void;

export type OrganizationGeneralEditorExternalPatch = {
  nonce: number;
  patch: Partial<OrganizationGeneralFormValues>;
};

type OrganizationGeneralEditorProps = {
  initialValues?: Partial<OrganizationGeneralFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  error?: string | null;
  externalPatch?: OrganizationGeneralEditorExternalPatch | null;
  bilingualMode?: OrganizationGeneralBilingualMode;
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
  readOnlyNames?: boolean;
  headerActions?: ReactNode;
  showDates?: boolean;
  title?: string;
  description?: string;
};

const DEFAULT_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  shortNameEn: "",
  fullName: "",
  fullNameEn: "",
  kind: "legal_entity",
  country: "",
  externalRef: "",
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

type BilingualTextFieldProps = {
  bilingualMode: OrganizationGeneralBilingualMode;
  control: Control<OrganizationGeneralFormValues>;
  ruName: FieldPath<OrganizationGeneralFormValues>;
  enName: FieldPath<OrganizationGeneralFormValues>;
  idBase: string;
  label: ReactNode;
  placeholderRu?: string;
  placeholderEn?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
};

function BilingualTextField({
  bilingualMode,
  control,
  ruName,
  enName,
  idBase,
  label,
  placeholderRu,
  placeholderEn,
  required,
  multiline,
  rows = 3,
  disabled,
}: BilingualTextFieldProps) {
  const showBoth = bilingualMode === "all";
  const showEnOnly = bilingualMode === "en";

  const renderInput = (
    name: FieldPath<OrganizationGeneralFormValues>,
    inputId: string,
    placeholder?: string,
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const fieldValue = typeof field.value === "string" ? field.value : "";
        const commonProps = {
          id: inputId,
          "aria-invalid": fieldState.invalid,
          placeholder,
          disabled,
        } as const;
        return (
          <>
            {multiline ? (
              <Textarea
                {...commonProps}
                name={field.name}
                ref={field.ref}
                value={fieldValue}
                onBlur={field.onBlur}
                onChange={field.onChange}
                rows={rows}
              />
            ) : (
              <Input
                {...commonProps}
                name={field.name}
                ref={field.ref}
                value={fieldValue}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </>
        );
      }}
    />
  );

  return (
    <Field className="md:col-span-2">
      <FieldLabel htmlFor={showEnOnly ? `${idBase}-en` : idBase}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      {showBoth ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              RU
            </span>
            {renderInput(ruName, idBase, placeholderRu)}
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              EN
            </span>
            {renderInput(enName, `${idBase}-en`, placeholderEn)}
          </div>
        </div>
      ) : showEnOnly ? (
        renderInput(enName, `${idBase}-en`, placeholderEn)
      ) : (
        renderInput(ruName, idBase, placeholderRu)
      )}
    </Field>
  );
}

export function OrganizationGeneralEditor({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  error,
  externalPatch,
  bilingualMode = "ru",
  onDirtyChange,
  onValuesChange,
  onSubmit,
  onShortNameChange,
  submitLabel = "Сохранить",
  submittingLabel = "Сохранение...",
  disableSubmitUntilDirty = true,
  kindReadonly = false,
  readOnlyNames = false,
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
    getValues,
    handleSubmit,
    reset,
    formState: { isDirty },
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

  const externalPatchNonce = externalPatch?.nonce ?? null;
  const externalPatchRef = useRef(externalPatch);
  externalPatchRef.current = externalPatch;
  useEffect(() => {
    const currentPatch = externalPatchRef.current;
    if (!currentPatch) {
      return;
    }

    const current = getValues();
    reset(
      { ...current, ...currentPatch.patch },
      { keepDirty: true, keepTouched: true },
    );
  }, [externalPatchNonce, getValues, reset]);

  const onShortNameChangeRef = useRef(onShortNameChange);
  onShortNameChangeRef.current = onShortNameChange;
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    onShortNameChangeRef.current?.(watchedShortName ?? "");
  }, [watchedShortName]);

  useEffect(() => {
    onValuesChangeRef.current?.({
      ...DEFAULT_VALUES,
      ...watchedValues,
    });
  }, [watchedValues]);

  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

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
  const namesDisabled = submitting || readOnlyNames;

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
              <div className="grid gap-4 md:grid-cols-2">
                <BilingualTextField
                  bilingualMode={bilingualMode}
                  control={control}
                  ruName="shortName"
                  enName="shortNameEn"
                  idBase="organization-short-name"
                  label="Краткое наименование"
                  placeholderRu="Например: Bedrock"
                  placeholderEn="e.g., Bedrock"
                  required
                  disabled={namesDisabled}
                />
                <BilingualTextField
                  bilingualMode={bilingualMode}
                  control={control}
                  ruName="fullName"
                  enName="fullNameEn"
                  idBase="organization-full-name"
                  label="Полное наименование"
                  placeholderRu="Например: Bedrock Holdings Limited"
                  placeholderEn="e.g., Bedrock Holdings Limited"
                  required
                  disabled={namesDisabled}
                />

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

                <Controller
                  name="externalRef"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="md:col-span-2"
                    >
                      <FieldLabel htmlFor="organization-external-id">
                        Внешний ID
                      </FieldLabel>
                      <FieldDescription>
                        Идентификатор во внешней системе (напр. 1С), только RU-поле.
                      </FieldDescription>
                      <Input
                        {...field}
                        id="organization-external-id"
                        aria-invalid={fieldState.invalid}
                        disabled={submitting}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="md:col-span-2"
                    >
                      <FieldLabel htmlFor="organization-description">
                        Описание
                      </FieldLabel>
                      <Textarea
                        id="organization-description"
                        name={field.name}
                        ref={field.ref}
                        value={
                          typeof field.value === "string" ? field.value : ""
                        }
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        placeholder="Дополнительная информация об организации"
                        disabled={submitting}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
              </div>
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
