"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
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
  FieldSeparator,
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
import { formatDate } from "@/lib/format";
import type { UserDetails } from "../lib/queries";

const ROLE_OPTIONS = [
  { value: "admin", label: "Админ" },
  { value: "user", label: "Пользователь" },
] as const;

type UserGeneralFormValues = {
  name: string;
  email: string;
  role: "admin" | "user";
};

const UserGeneralFormSchema = z.object({
  name: z.string().trim().min(1, "Имя обязательно"),
  email: z.email("Некорректный email"),
  role: z.enum(["admin", "user"]),
});

type UserGeneralFormProps = {
  user: UserDetails;
};

function toFormValues(user: UserDetails): UserGeneralFormValues {
  return {
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
  };
}

export function UserGeneralForm({ user }: UserGeneralFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(() => toFormValues(user), [user]);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserGeneralFormValues>({
    resolver: zodResolver(UserGeneralFormSchema),
    defaultValues: initial,
    mode: "onChange",
  });

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  async function onSubmit(values: UserGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].$patch({
          param: { id: user.id },
          json: {
            name: values.name.trim(),
            email: values.email.trim(),
            role: values.role,
          },
        }),
      fallbackMessage: "Не удалось обновить пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    reset(toFormValues(result.data));
    toast.success("Пользователь обновлен");
    router.refresh();
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
        <form id="user-general-form" onSubmit={handleSubmit(onSubmit)}>
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
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input readOnly disabled value={formatDate(user.createdAt)} />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input readOnly disabled value={formatDate(user.updatedAt)} />
              </Field>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
