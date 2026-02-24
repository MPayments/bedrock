"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2, X } from "lucide-react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import { Spinner } from "@bedrock/ui/components/spinner";

export type CustomerGeneralFormValues = {
  displayName: string;
  externalRef: string;
};

type CustomerGeneralFormSubmit =
  | Promise<CustomerGeneralFormValues | void>
  | CustomerGeneralFormValues
  | void;

type CustomerGeneralFormDelete = Promise<boolean | void> | boolean | void;

type CustomerGeneralFormProps = {
  initialValues?: Partial<CustomerGeneralFormValues>;
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
};

type CustomerGeneralFormBaseProps = CustomerGeneralFormProps & {
  variant: CustomerGeneralFormVariant;
};

const DEFAULT_VALUES: CustomerGeneralFormValues = {
  displayName: "",
  externalRef: "",
};

const CustomerGeneralFormSchema = z.object({
  displayName: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
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
  };
}

function valuesSignature(values: CustomerGeneralFormValues) {
  return `${values.displayName}\n${values.externalRef}`;
}

const CREATE_GENERAL_FORM_VARIANT: CustomerGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
};

const EDIT_GENERAL_FORM_VARIANT: CustomerGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
};

function CustomerGeneralFormBase({
  initialValues,
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

  const currentValues = useMemo(
    () =>
      normalizeValues({
        displayName: watchedValues?.displayName ?? "",
        externalRef: watchedValues?.externalRef ?? "",
      }),
    [watchedValues?.displayName, watchedValues?.externalRef],
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
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger
                  render={
                    <Button variant="destructive" type="button" disabled={deleteDisabled} />
                  }
                >
                  <Trash2 className="size-4" />
                  Удалить
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Удалить клиента?</DialogTitle>
                    <DialogDescription>
                      Действие удалит клиента и отвяжет связанные клиентские
                      контрагенты от customers-ветки.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" type="button" />}>
                      Отмена
                    </DialogClose>
                    <Button
                      variant="destructive"
                      type="button"
                      disabled={deleteDisabled}
                      onClick={handleDelete}
                    >
                      {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
                      {deleting ? "Удаление..." : "Удалить"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              </FieldGroup>
            </FieldSet>
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
