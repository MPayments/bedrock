"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
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
  CreatedUser,
  MutationResult,
  RoleOption,
} from "../lib/contracts";
import {
  createCreateUserFormSchema,
  type CreateUserFormValues,
} from "../lib/schemas";
import { PasswordFieldWithGenerator } from "./password-field-with-generator";

type CreateUserFormProps = {
  roleOptions: readonly RoleOption[];
  defaultRole?: string;
  onSubmit: (
    values: CreateUserFormValues,
  ) => Promise<MutationResult<CreatedUser>>;
  onCancel?: () => void;
};

export function CreateUserForm({
  roleOptions,
  defaultRole,
  onSubmit,
  onCancel,
}: CreateUserFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(
    () => createCreateUserFormSchema(roleOptions.map((o) => o.value)),
    [roleOptions],
  );

  const initialRole = useMemo(() => {
    if (defaultRole && roleOptions.some((o) => o.value === defaultRole)) {
      return defaultRole;
    }
    return roleOptions[0]?.value ?? "";
  }, [defaultRole, roleOptions]);

  const initialValues = useMemo<CreateUserFormValues>(
    () => ({
      name: "",
      email: "",
      password: "",
      role: initialRole,
    }),
    [initialRole],
  );

  const {
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  async function handleFormSubmit(values: CreateUserFormValues) {
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
    }
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Создание пользователя</CardTitle>
            <CardDescription>
              Заполните данные для нового пользователя.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                <X className="size-4" />
                Отмена
              </Button>
            )}
            <Button
              type="submit"
              form="create-user-form"
              disabled={submitting}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {submitting ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="create-user-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(errors.name)}>
                    <FieldLabel htmlFor="create-user-name">Имя</FieldLabel>
                    <Input
                      {...register("name")}
                      id="create-user-name"
                      aria-invalid={Boolean(errors.name)}
                      placeholder="Иван Иванов"
                    />
                    <FieldError errors={[errors.name]} />
                  </Field>
                  <Field data-invalid={Boolean(errors.email)}>
                    <FieldLabel htmlFor="create-user-email">Email</FieldLabel>
                    <Input
                      {...register("email")}
                      id="create-user-email"
                      aria-invalid={Boolean(errors.email)}
                      placeholder="user@example.com"
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(errors.password)}>
                    <FieldLabel htmlFor="create-user-password">
                      Пароль
                    </FieldLabel>
                    <PasswordFieldWithGenerator
                      id="create-user-password"
                      fieldName="password"
                      registration={register("password")}
                      setValue={setValue}
                      invalid={Boolean(errors.password)}
                    />
                    <FieldError errors={[errors.password]} />
                  </Field>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="create-user-role">Роль</FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="create-user-role"
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
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
