"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

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
  FieldError,
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
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import { PasswordFieldWithGenerator } from "./password-field-with-generator";

const ROLE_OPTIONS = [
  { value: "admin", label: "Админ" },
  { value: "user", label: "Пользователь" },
] as const;

const CreateUserFormSchema = z.object({
  name: z.string().trim().min(1, "Имя обязательно"),
  email: z.email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
  role: z.enum(["admin", "user"]),
});

type CreateUserFormValues = z.infer<typeof CreateUserFormSchema>;

type CreatedUser = {
  id: string;
};

export function CreateUserFormClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<CreateUserFormValues>(
    () => ({
      name: "",
      email: "",
      password: "",
      role: "user",
    }),
    [],
  );

  const {
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(CreateUserFormSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  async function onSubmit(values: CreateUserFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedUser>({
      request: () =>
        apiClient.v1.users.$post({
          json: {
            name: values.name.trim(),
            email: values.email.trim(),
            password: values.password,
            role: values.role,
          },
        }),
      fallbackMessage: "Не удалось создать пользователя",
      parseData: async (response) => (await response.json()) as CreatedUser,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Пользователь создан");
    router.push(`/users/${result.data.id}`);
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
      </CardHeader>
      <CardContent>
        <form id="create-user-form" onSubmit={handleSubmit(onSubmit)}>
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
                                ROLE_OPTIONS.find(
                                  (o) => o.value === field.value,
                                )?.label
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {ROLE_OPTIONS.map((option) => (
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
