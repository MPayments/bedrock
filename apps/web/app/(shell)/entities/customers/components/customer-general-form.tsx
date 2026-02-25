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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import { Spinner } from "@bedrock/ui/components/spinner";
import { Textarea } from "@bedrock/ui/components/textarea";

import { CustomerDeleteDialog } from "./customer-delete-dialog";
import { formatDate } from "@/lib/format";

export type CustomerGeneralFormValues = {
  displayName: string;
  externalRef: string;
  description: string;
};

type CustomerGeneralFormSubmit =
  | Promise<CustomerGeneralFormValues | void>
  | CustomerGeneralFormValues
  | void;

type CustomerGeneralFormDelete = Promise<boolean | void> | boolean | void;

type CustomerGeneralFormProps = {
  initialValues?: Partial<CustomerGeneralFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: CustomerGeneralFormValues) => CustomerGeneralFormSubmit;
  onDelete?: () => CustomerGeneralFormDelete;
  onDisplayNameChange?: (name: string) => void;
};

type CustomerGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  showDelete: boolean;
  usePlaceholderDates: boolean;
};

type CustomerGeneralFormBaseProps = CustomerGeneralFormProps & {
  variant: CustomerGeneralFormVariant;
};

const DEFAULT_VALUES: CustomerGeneralFormValues = {
  displayName: "",
  externalRef: "",
  description: "",
};

const CustomerGeneralFormSchema = z.object({
  displayName: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
  description: z.string(),
});

function resolveInitialValues(
  initialValues?: Partial<CustomerGeneralFormValues>,
): CustomerGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

function normalizeValues(
  values: CustomerGeneralFormValues,
): CustomerGeneralFormValues {
  return {
    displayName: values.displayName.trim(),
    externalRef: values.externalRef.trim(),
    description: values.description.trim(),
  };
}

function valuesSignature(values: CustomerGeneralFormValues) {
  return `${values.displayName}\n${values.externalRef}\n${values.description}`;
}

const CREATE_GENERAL_FORM_VARIANT: CustomerGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
  usePlaceholderDates: true,
};

const EDIT_GENERAL_FORM_VARIANT: CustomerGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
  usePlaceholderDates: false,
};

function CustomerGeneralFormBase({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onDisplayNameChange,
  variant,
}: CustomerGeneralFormBaseProps) {
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
  } = useForm<CustomerGeneralFormValues>({
    resolver: zodResolver(CustomerGeneralFormSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const watchedDisplayName = watchedValues?.displayName ?? "";
  const formattedCreatedAt = useMemo(() => {
    if (variant.usePlaceholderDates) {
      return "—";
    }

    return formatDate(createdAt ?? "") || "—";
  }, [createdAt, variant.usePlaceholderDates]);
  const formattedUpdatedAt = useMemo(() => {
    if (variant.usePlaceholderDates) {
      return "—";
    }

    return formatDate(updatedAt ?? "") || "—";
  }, [updatedAt, variant.usePlaceholderDates]);

  const currentValues = useMemo(
    () =>
      normalizeValues({
        displayName: watchedValues?.displayName ?? "",
        externalRef: watchedValues?.externalRef ?? "",
        description: watchedValues?.description ?? "",
      }),
    [
      watchedValues?.description,
      watchedValues?.displayName,
      watchedValues?.externalRef,
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
    onDisplayNameChange?.(watchedDisplayName);
  }, [onDisplayNameChange, watchedDisplayName]);

  function handleReset() {
    reset(initial);
  }

  async function handleFormSubmit(values: CustomerGeneralFormValues) {
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
              Просмотр и редактирование информации клиента.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="customer-general-form"
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
              <CustomerDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                deleting={deleting}
                onDelete={handleDelete}
                description="Действие удалит клиента и отвяжет связанные клиентские контрагенты от customers-ветки."
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
          id="customer-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <Controller
                  name="displayName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="customer-display-name">
                        Название клиента
                      </FieldLabel>
                      <Input
                        {...field}
                        id="customer-display-name"
                        aria-invalid={fieldState.invalid}
                        placeholder="Например: Acme Corp"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Field data-invalid={Boolean(errors.externalRef)}>
                  <FieldLabel htmlFor="customer-external-ref">
                    External Ref
                  </FieldLabel>
                  <Input
                    {...register("externalRef")}
                    id="customer-external-ref"
                    aria-invalid={Boolean(errors.externalRef)}
                    placeholder="Например: crm-123"
                  />
                  <FieldError errors={[errors.externalRef]} />
                </Field>
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="customer-description">Описание</FieldLabel>
                  <FieldDescription>
                    Дополнительная информация о клиенте
                  </FieldDescription>
                  <Textarea
                    {...register("description")}
                    id="customer-description"
                    aria-invalid={Boolean(errors.description)}
                    rows={3}
                  />
                  <FieldError errors={[errors.description]} />
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input readOnly disabled value={formattedCreatedAt} />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input readOnly disabled value={formattedUpdatedAt} />
              </Field>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function CustomerCreateGeneralForm(props: CustomerGeneralFormProps) {
  return (
    <CustomerGeneralFormBase
      variant={CREATE_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

export function CustomerEditGeneralForm(props: CustomerGeneralFormProps) {
  return (
    <CustomerGeneralFormBase
      variant={EDIT_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}
