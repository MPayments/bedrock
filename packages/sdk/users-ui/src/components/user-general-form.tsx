"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  FieldSet,
  Field,
  FieldError,
  FieldSeparator,
} from "@bedrock/sdk-ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/sdk-ui/components/select";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import type {
  MutationResult,
  RoleOption,
  UserDetails,
} from "../lib/contracts";
import {
  createUserGeneralFormSchema,
  type UserGeneralFormValues,
} from "../lib/schemas";
import { formatDateRu } from "../lib/format-date";

type UserGeneralFormProps = {
  user: UserDetails;
  roleOptions: readonly RoleOption[];
  fallbackRole?: string;
  onSubmit: (
    values: UserGeneralFormValues,
  ) => Promise<MutationResult<UserDetails>>;
};

function toFormValues(
  user: UserDetails,
  roleOptions: readonly RoleOption[],
  fallbackRole: string | undefined,
): UserGeneralFormValues {
  const validRoles = new Set(roleOptions.map((o) => o.value));
  const resolvedRole =
    user.role && validRoles.has(user.role)
      ? user.role
      : (fallbackRole ?? roleOptions[0]?.value ?? "");
  return {
    name: user.name,
    email: user.email,
    role: resolvedRole,
  };
}

export function UserGeneralForm({
  user,
  roleOptions,
  fallbackRole,
  onSubmit,
}: UserGeneralFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(
    () => createUserGeneralFormSchema(roleOptions.map((o) => o.value)),
    [roleOptions],
  );

  const initial = useMemo(
    () => toFormValues(user, roleOptions, fallbackRole),
    [user, roleOptions, fallbackRole],
  );

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserGeneralFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: "onChange",
  });

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  async function handleFormSubmit(values: UserGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await onSubmit({
      ...values,
      name: values.name.trim(),
      email: values.email.trim(),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    reset(toFormValues(result.data, roleOptions, fallbackRole));
  }

  function handleReset() {
    reset(initial);
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Общая информация</CardTitle>
            <CardDescription>
              Просмотр и редактирование данных пользователя.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="user-general-form"
              disabled={submitting || !isDirty}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={submitting || !isDirty}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="user-general-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(errors.name)}>
                    <FieldLabel htmlFor="user-name">Имя</FieldLabel>
                    <Input
                      {...register("name")}
                      id="user-name"
                      aria-invalid={Boolean(errors.name)}
                      placeholder="Иван Иванов"
                    />
                    <FieldError errors={[errors.name]} />
                  </Field>
                  <Field data-invalid={Boolean(errors.email)}>
                    <FieldLabel htmlFor="user-email">Email</FieldLabel>
                    <Input
                      {...register("email")}
                      id="user-email"
                      aria-invalid={Boolean(errors.email)}
                      placeholder="user@example.com"
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Controller
                    name="role"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="user-role">Роль</FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="user-role"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите роль">
                              {
                                roleOptions.find(
                                  (o) => o.value === field.value,
                                )?.label
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {roleOptions.map((option) => (
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
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input readOnly disabled value={formatDateRu(user.createdAt)} />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input readOnly disabled value={formatDateRu(user.updatedAt)} />
              </Field>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
