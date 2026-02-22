"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "@bedrock/organizations/validation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  FieldSet,
  Field,
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldContent,
  FieldTitle,
} from "@bedrock/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/ui/components/select";
import { Input } from "@bedrock/ui/components/input";
import { Switch } from "@bedrock/ui/components/switch";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";

import { formatDate } from "@/lib/format";

export type OrganizationGeneralFormValues = {
  name: string;
  country: string;
  baseCurrency: string;
  externalId: string;
  isTreasury: boolean;
  customerId: string;
};

type OrganizationGeneralFormSubmit =
  | Promise<OrganizationGeneralFormValues | void>
  | OrganizationGeneralFormValues
  | void;

type OrganizationGeneralFormProps = {
  initialValues?: Partial<OrganizationGeneralFormValues>;
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: OrganizationGeneralFormValues,
  ) => OrganizationGeneralFormSubmit;
  onNameChange?: (name: string) => void;
};

type OrganizationGeneralFormVariant = {
  schema:
    | typeof CreateOrganizationInputSchema
    | typeof UpdateOrganizationInputSchema;
  submitLabel: string;
  submittingLabel: string;
  disableTreasuryFields: boolean;
  disableSubmitUntilDirty: boolean;
  usePlaceholderDates: boolean;
};

type OrganizationGeneralFormBaseProps = OrganizationGeneralFormProps & {
  variant: OrganizationGeneralFormVariant;
};

const DEFAULT_VALUES: OrganizationGeneralFormValues = {
  name: "",
  country: "",
  baseCurrency: "USD",
  externalId: "",
  isTreasury: true,
  customerId: "",
};

function resolveInitialValues(
  initialValues?: Partial<OrganizationGeneralFormValues>,
): OrganizationGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

const CREATE_GENERAL_FORM_VARIANT: OrganizationGeneralFormVariant = {
  schema: CreateOrganizationInputSchema,
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableTreasuryFields: false,
  disableSubmitUntilDirty: false,
  usePlaceholderDates: true,
};

const EDIT_GENERAL_FORM_VARIANT: OrganizationGeneralFormVariant = {
  schema: UpdateOrganizationInputSchema,
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableTreasuryFields: true,
  disableSubmitUntilDirty: true,
  usePlaceholderDates: false,
};

function OrganizationGeneralFormBase({
  initialValues,
  submitting = false,
  error,
  onSubmit,
  onNameChange,
  variant,
}: OrganizationGeneralFormBaseProps) {
  const initialName = initialValues?.name;
  const initialCountry = initialValues?.country;
  const initialBaseCurrency = initialValues?.baseCurrency;
  const initialExternalId = initialValues?.externalId;
  const initialIsTreasury = initialValues?.isTreasury;
  const initialCustomerId = initialValues?.customerId;

  const initial = useMemo(
    () =>
      resolveInitialValues({
        name: initialName,
        country: initialCountry,
        baseCurrency: initialBaseCurrency,
        externalId: initialExternalId,
        isTreasury: initialIsTreasury,
        customerId: initialCustomerId,
      }),
    [
      initialBaseCurrency,
      initialCountry,
      initialCustomerId,
      initialExternalId,
      initialIsTreasury,
      initialName,
    ],
  );

  const formResolver = useMemo(
    () =>
      zodResolver(variant.schema, undefined, {
        raw: true,
      }),
    [variant.schema],
  );

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<OrganizationGeneralFormValues>({
    resolver: formResolver as never,
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: true,
  });

  const isTreasury = watch("isTreasury");
  const nowFormatted = formatDate(new Date());

  useEffect(() => {
    reset(initial);
    onNameChange?.(initial.name);
  }, [initial, onNameChange, reset]);

  function handleReset() {
    reset(initial);
    onNameChange?.(initial.name);
  }

  async function handleFormSubmit(values: OrganizationGeneralFormValues) {
    if (!onSubmit) return;

    const submittedValues = await onSubmit(values);
    if (submittedValues) {
      reset(submittedValues);
      onNameChange?.(submittedValues.name);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации организации
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
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
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
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="organization-name">
                        Название
                      </FieldLabel>
                      <Input
                        {...field}
                        id="organization-name"
                        aria-invalid={fieldState.invalid}
                        placeholder="Наименование организации"
                        onChange={(event) => {
                          field.onChange(event);
                          onNameChange?.(event.target.value);
                        }}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <div className="grid md:grid-cols-3 gap-4">
                  <Field data-invalid={Boolean(errors.country)}>
                    <FieldLabel htmlFor="organization-country">
                      Страна
                    </FieldLabel>
                    <Input
                      {...register("country")}
                      id="organization-country"
                      aria-invalid={Boolean(errors.country)}
                      placeholder="Например: Россия"
                    />
                    <FieldError errors={[errors.country]} />
                  </Field>
                  <Controller
                    name="baseCurrency"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="organization-base-currency">
                          Базовая валюта
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="organization-base-currency"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите валюту" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="RUB">RUB</SelectItem>
                              <SelectItem value="USDT">USDT</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.externalId)}>
                    <FieldLabel htmlFor="organization-external-id">
                      External ID
                    </FieldLabel>
                    <Input
                      {...register("externalId")}
                      id="organization-external-id"
                      aria-invalid={Boolean(errors.externalId)}
                      placeholder="Например: crm-123"
                    />
                    <FieldError errors={[errors.externalId]} />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor="organization-treasury">
                  <Controller
                    name="isTreasury"
                    control={control}
                    render={({ field }) => (
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>
                            {field.value
                              ? "Принадлежит казначейству"
                              : "Не принадлежит казначейству"}
                          </FieldTitle>
                          <FieldDescription>
                            Если выключено, требуется UUID клиента.
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="organization-treasury"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={variant.disableTreasuryFields}
                        />
                      </Field>
                    )}
                  />
                </FieldLabel>
              </FieldGroup>

              {!isTreasury && (
                <Field data-invalid={Boolean(errors.customerId)}>
                  <FieldLabel htmlFor="organization-customer-id">
                    Customer ID (UUID)
                  </FieldLabel>
                  <Input
                    {...register("customerId")}
                    id="organization-customer-id"
                    aria-invalid={Boolean(errors.customerId)}
                    placeholder="00000000-0000-4000-8000-000000000000"
                    disabled={variant.disableTreasuryFields}
                  />
                  <FieldError errors={[errors.customerId]} />
                </Field>
              )}
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
