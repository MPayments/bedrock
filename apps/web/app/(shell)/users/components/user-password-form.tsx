"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multihansa/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  Field,
  FieldError,
} from "@multihansa/ui/components/field";
import { Button } from "@multihansa/ui/components/button";
import { Spinner } from "@multihansa/ui/components/spinner";
import { toast } from "@multihansa/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import { PasswordFieldWithGenerator } from "./password-field-with-generator";

const ChangePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, "Пароль должен содержать минимум 6 символов"),
});

type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

type UserPasswordFormProps = {
  userId: string;
};

export function UserPasswordForm({ userId }: UserPasswordFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { newPassword: "" },
  });

  async function onSubmit(values: ChangePasswordValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<{ success: boolean }>({
      request: () =>
        apiClient.v1.users[":id"]["change-password"].$post({
          param: { id: userId },
          json: { newPassword: values.newPassword },
        }),
      fallbackMessage: "Не удалось сменить пароль",
      parseData: async (response) =>
        (await response.json()) as { success: boolean },
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    reset();
    toast.success("Пароль успешно изменен");
  }

  return (
    <Card className="h-full w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Смена пароля
          </CardTitle>
          <CardDescription>
            Установите новый пароль для пользователя.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={Boolean(errors.newPassword)}>
                <FieldLabel htmlFor="user-new-password">
                  Новый пароль
                </FieldLabel>
                <PasswordFieldWithGenerator
                  id="user-new-password"
                  fieldName="newPassword"
                  registration={register("newPassword")}
                  setValue={setValue}
                  invalid={Boolean(errors.newPassword)}
                />
                <FieldError errors={[errors.newPassword]} />
              </Field>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Spinner className="size-4" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {submitting ? "Сохранение..." : "Сменить пароль"}
                </Button>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
